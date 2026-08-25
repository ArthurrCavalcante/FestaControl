import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, HttpError, requireLiveTenant } from "../_shared/auth.ts";
import { captureEdgeError } from "../_shared/observability.ts";
import { createPublicToken } from "../_shared/public-token.ts";
import { subscriptionCanWrite } from "../_shared/saas-security.ts";
import { loadSupabaseRequestContext } from "../_shared/supabase-auth.ts";
import { normalizeEvolutionState } from "../_shared/whatsapp-automation.ts";
import {
  buildEvolutionWebhookConfig,
  buildEvolutionWebhookSetPayload,
} from "../_shared/evolution-webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function evolutionRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
  const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
  if (!baseUrl || !apiKey) throw new HttpError(502, "WhatsApp provider is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", apikey: apiKey, ...init.headers },
    });
  } catch {
    throw new HttpError(502, "WhatsApp provider is unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

async function providerJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text.slice(0, 300) };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const context = await loadSupabaseRequestContext(req);
    requireLiveTenant(context);
    if (!subscriptionCanWrite(context.subscription ?? null)) {
      throw new HttpError(403, "Subscription is read-only");
    }
    if (context.role === "staff") throw new HttpError(403, "Manager permission required");

    const instanceName = context.companyId;

    if (req.method === "GET") {
      const response = await evolutionRequest(`/instance/connectionState/${instanceName}`);
      if (response.status === 404) throw new HttpError(404, "WhatsApp connection not found");
      if (!response.ok) throw new HttpError(502, "Could not read WhatsApp status");
      const data = await providerJson(response);
      const state = normalizeEvolutionState(data);
      const { data: currentSettings } = await context.client.from("company_settings")
        .select("whatsapp_status").eq("company_id", context.companyId).maybeSingle();
      if (currentSettings?.whatsapp_status !== state) {
        await context.client.from("company_settings").update({
          whatsapp_status: state,
          whatsapp_qr_expires_at: state === "connecting" ? undefined : null,
          whatsapp_last_error: null,
        }).eq("company_id", context.companyId);
        if (state === "connected") {
          await context.client.from("product_events").insert({
            company_id: context.companyId,
            user_id: context.userId,
            event_name: "whatsapp_connected",
            properties: { provider: "evolution" },
          });
        }
      }
      return new Response(JSON.stringify({ success: true, instance: instanceName, state: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const instanceToken = createPublicToken();
      const webhook = buildEvolutionWebhookConfig(
        Deno.env.get("WEBHOOK_URL"),
        Deno.env.get("EVOLUTION_WEBHOOK_SECRET"),
      );
      const createResponse = await evolutionRequest("/instance/create", {
        method: "POST",
        body: JSON.stringify({
          instanceName,
          token: instanceToken,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook,
        }),
      });
      const createData = await providerJson(createResponse);
      const alreadyExists = /already|exist|defined/i.test(JSON.stringify(createData));
      if (!createResponse.ok && !alreadyExists) {
        throw new HttpError(502, "Could not create WhatsApp connection");
      }

      const webhookResponse = await evolutionRequest(`/webhook/set/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(buildEvolutionWebhookSetPayload(webhook)),
      });
      if (!webhookResponse.ok) throw new HttpError(502, "Could not secure WhatsApp webhook");

      const qrResponse = await evolutionRequest(`/instance/connect/${instanceName}`);
      const qrData = await providerJson(qrResponse);
      if (!qrResponse.ok) throw new HttpError(502, "Could not generate WhatsApp QR code");

      const qrExpiresAt = new Date(Date.now() + 60_000).toISOString();
      const { error: connectionError } = await context.client.from("company_connections").upsert({
        company_id: context.companyId,
        platform: "evolution",
        provider: "evolution",
        external_id: instanceName,
        display_name: "WhatsApp Evolution (beta)",
        status: "ACTIVE",
        metadata: { beta: true },
        last_sync_at: new Date().toISOString(),
      }, { onConflict: "platform,external_id" });
      if (connectionError) throw connectionError;

      const { error: settingsError } = await context.client.from("company_settings").update({
        whatsapp_status: "connecting",
        whatsapp_qr_expires_at: qrExpiresAt,
        whatsapp_last_error: null,
      }).eq("company_id", context.companyId);
      if (settingsError) throw settingsError;
      await context.client.from("product_events").insert({
        company_id: context.companyId,
        user_id: context.userId,
        event_name: "whatsapp_connection_started",
        properties: { provider: "evolution" },
      });

      return new Response(JSON.stringify({
        success: true,
        base64: qrData.base64 ?? (qrData.qrcode as Record<string, unknown> | undefined)?.base64,
        expires_at: qrExpiresAt,
        instance: instanceName,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "DELETE") {
      const logoutResponse = await evolutionRequest(`/instance/logout/${instanceName}`, { method: "DELETE" });
      if (!logoutResponse.ok && logoutResponse.status !== 404) {
        throw new HttpError(502, "Could not disconnect WhatsApp");
      }
      await evolutionRequest(`/instance/delete/${instanceName}`, { method: "DELETE" });

      const { error: settingsError } = await context.client.from("company_settings").update({
        whatsapp_status: "disconnected",
        whatsapp_qr_expires_at: null,
        whatsapp_last_error: null,
      }).eq("company_id", context.companyId);
      if (settingsError) throw settingsError;
      await context.client.from("company_connections").update({ status: "INACTIVE" })
        .eq("company_id", context.companyId).eq("platform", "evolution");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new HttpError(405, "Method not allowed");
  } catch (error) {
    if (!(error instanceof HttpError)) await captureEdgeError(error, "whatsapp-session", req);
    return errorResponse(error, corsHeaders);
  }
});

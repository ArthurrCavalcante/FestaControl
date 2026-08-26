import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { ProviderFactory } from "../_shared/providers/ProviderFactory.ts";
import { errorResponse, HttpError, requireLiveTenant, requireTenantResource } from "../_shared/auth.ts";
import { loadSupabaseRequestContext } from "../_shared/supabase-auth.ts";
import { captureEdgeError } from "../_shared/observability.ts";
import { subscriptionCanWrite } from "../_shared/saas-security.ts";
import { createServiceClient } from "../_shared/service-client.ts";
import { sendWithProviderRetry } from "../_shared/provider-retry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const context = await loadSupabaseRequestContext(req);
    const body = await req.json();
    const conversationId = body?.conversation_id;
    const content = body?.content;
    if (typeof conversationId !== "string" || typeof content !== "string" || !content.trim() || content.length > 4_000) {
      throw new HttpError(400, "Invalid request payload");
    }

    const { data: conversation, error: conversationError } = await context.client
      .from("conversations")
      .select("remetente_id, canal, company_id")
      .eq("id", conversationId)
      .eq("company_id", context.companyId)
      .maybeSingle();
    if (conversationError) throw conversationError;
    const authorizedConversation = requireTenantResource(conversation, context.companyId);

    requireLiveTenant(context);
    if (!subscriptionCanWrite(context.subscription ?? null)) {
      throw new HttpError(403, "Subscription is read-only");
    }
    const { data: whatsappState } = await context.client.from("company_settings")
      .select("whatsapp_breaker_until").eq("company_id", context.companyId).maybeSingle();
    if (whatsappState?.whatsapp_breaker_until && new Date(whatsappState.whatsapp_breaker_until).getTime() > Date.now()) {
      throw new HttpError(502, "WhatsApp is temporarily unavailable. Use the manual fallback");
    }
    const provider = ProviderFactory.getProviderByName(authorizedConversation.canal);
    if (!provider) throw new HttpError(400, "Unsupported channel");
    let sendResult;
    const service = createServiceClient();
    try {
      sendResult = await sendWithProviderRetry(() => provider.send(
        authorizedConversation.remetente_id,
        content,
        { company_id: context.companyId },
      ));
      await service.rpc("record_whatsapp_delivery", { p_company_id: context.companyId, p_success: true });
    } catch (providerError) {
      await service.rpc("record_whatsapp_delivery", { p_company_id: context.companyId, p_success: false });
      throw providerError;
    }

    const { data: newMessage, error: insertError } = await context.client
      .from("messages")
      .insert({
        company_id: context.companyId,
        conversation_id: conversationId,
        direction: "OUTBOUND",
        sender_type: "HUMAN",
        content,
        provider_message_id: sendResult.providerMessageId,
      })
      .select()
      .single();
    if (insertError) throw insertError;

    const { error: updateError } = await context.client
      .from("conversations")
      .update({ last_message: content, last_activity: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("company_id", context.companyId);
    if (updateError) throw updateError;

    await context.client.from("product_events").insert({
      company_id: context.companyId,
      user_id: context.userId,
      event_name: "whatsapp_message_sent",
      properties: { provider: provider.name, source: "inbox" },
    });

    return new Response(JSON.stringify({ success: true, message: newMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (!(error instanceof HttpError)) await captureEdgeError(error, "send-message", req);
    return errorResponse(error, corsHeaders);
  }
});

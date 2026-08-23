import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { HttpError, errorResponse } from "../_shared/auth.ts";
import { captureEdgeError } from "../_shared/observability.ts";
import { hashPublicToken, ipPrefix } from "../_shared/public-token.ts";
import { createServiceClient } from "../_shared/service-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json() : null;
    const token = body?.token ?? new URL(req.url).searchParams.get("token");
    if (typeof token !== "string" || token.length < 32 || token.length > 128) throw new HttpError(404, "Proposal not found");
    const service = createServiceClient();
    const tokenHash = await hashPublicToken(token);
    const { data: proposal } = await service.from("proposals")
      .select("id, company_id, deal_id, version, status, customer_name, event_date, event_address, theme, valid_until, subtotal, discount, total, terms, sent_at, viewed_at, accepted_at, confirmed_at, proposal_items(description, quantity, unit_price, image_path, sort_order)")
      .eq("public_token_hash", tokenHash).maybeSingle();
    if (!proposal || proposal.status === "draft") throw new HttpError(404, "Proposal not found");

    const expired = proposal.status !== "accepted" && proposal.status !== "confirmed" &&
      new Date(`${proposal.valid_until}T23:59:59`).getTime() < Date.now();
    if (expired) {
      await service.from("proposals").update({ status: "expired" }).eq("id", proposal.id);
      throw new HttpError(410, "Proposal expired");
    }

    const [{ data: settings }, { data: company }] = await Promise.all([
      service.from("company_settings").select("logo_url, pix_key, telefone, whatsapp, instagram, endereco, primary_color")
        .eq("company_id", proposal.company_id).maybeSingle(),
      service.from("companies").select("nome, documento, status, is_demo").eq("id", proposal.company_id).maybeSingle(),
    ]);
    if (!company || company.status !== "ACTIVE" || company.is_demo) throw new HttpError(404, "Proposal not found");

    if (req.method === "GET") {
      if (proposal.status === "sent") {
        const viewedAt = new Date().toISOString();
        await service.from("proposals").update({ status: "viewed", viewed_at: viewedAt }).eq("id", proposal.id).eq("status", "sent");
        await service.from("product_events").insert({
          company_id: proposal.company_id, event_name: "proposal_viewed", properties: { proposal_id: proposal.id },
        });
        proposal.status = "viewed";
        proposal.viewed_at = viewedAt;
      }
      return new Response(JSON.stringify({ proposal, company, settings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    if (req.method === "POST") {
      const action = body?.action;
      if (!["accept", "reject"].includes(action)) throw new HttpError(400, "Invalid action");
      if (["accepted", "confirmed"].includes(proposal.status) && action === "accept") {
        return new Response(JSON.stringify({ success: true, status: proposal.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (proposal.status === "rejected" && action === "reject") {
        return new Response(JSON.stringify({ success: true, status: "rejected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["sent", "viewed"].includes(proposal.status)) throw new HttpError(409, "Proposal is no longer actionable");

      const now = new Date().toISOString();
      const nextStatus = action === "accept" ? "accepted" : "rejected";
      const updates = action === "accept"
        ? {
          status: nextStatus, accepted_at: now,
          accepted_ip_prefix: ipPrefix(req.headers.get("x-forwarded-for")),
          accepted_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
        }
        : { status: nextStatus, rejected_at: now };
      const { data: changed, error } = await service.from("proposals").update(updates)
        .eq("id", proposal.id).in("status", ["sent", "viewed"]).select("id").maybeSingle();
      if (error) throw error;
      if (!changed) {
        const { data: current } = await service.from("proposals").select("status").eq("id", proposal.id).maybeSingle();
        if (current?.status === nextStatus || (action === "accept" && current?.status === "confirmed")) {
          return new Response(JSON.stringify({ success: true, status: current.status }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new HttpError(409, "Proposal was already answered");
      }
      if (action === "accept") {
        await service.from("product_events").insert({
          company_id: proposal.company_id, event_name: "proposal_accepted", properties: { proposal_id: proposal.id },
        });
        await service.from("deals").update({ proposta_status: "APROVADA", proposta_aceita_em: now, status_funil: "SINAL" })
          .eq("id", proposal.deal_id).eq("company_id", proposal.company_id);
      }
      return new Response(JSON.stringify({ success: true, status: nextStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new HttpError(405, "Method not allowed");
  } catch (error) {
    if (!(error instanceof HttpError)) await captureEdgeError(error, "public-proposal", req);
    return errorResponse(error, corsHeaders);
  }
});

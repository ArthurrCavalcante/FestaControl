import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, HttpError, requireLiveTenant } from "../_shared/auth.ts";
import { captureEdgeError } from "../_shared/observability.ts";
import { createPublicToken, hashPublicToken } from "../_shared/public-token.ts";
import { subscriptionCanWrite } from "../_shared/saas-security.ts";
import { loadSupabaseRequestContext } from "../_shared/supabase-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ProposalItemInput = {
  company_id: string;
  acervo_id: unknown;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  image_path: string | null;
  sort_order: number;
};

const money = (value: unknown): number => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new HttpError(400, "Invalid monetary value");
  return Math.round(number * 100) / 100;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const context = await loadSupabaseRequestContext(req);

    if (req.method === "GET") {
      const { data, error } = await context.client.from("proposals")
        .select("*, proposal_items(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ proposals: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
    requireLiveTenant(context);
    if (!subscriptionCanWrite(context.subscription ?? null)) throw new HttpError(403, "Subscription is read-only");

    const body = await req.json();
    const action = body?.action;

    if (action === "create") {
      const customerName = String(body.customer_name ?? "").trim();
      const items = Array.isArray(body.items) ? body.items : [];
      if (customerName.length < 2 || customerName.length > 160 || items.length < 1 || items.length > 100) {
        throw new HttpError(400, "Invalid proposal payload");
      }
      if (body.deal_id) {
        const { data: deal } = await context.client.from("deals").select("id")
          .eq("id", body.deal_id).eq("company_id", context.companyId).maybeSingle();
        if (!deal) throw new HttpError(404, "Deal not found");
      }

      const normalizedItems: ProposalItemInput[] = items.map((item: Record<string, unknown>, index: number) => {
        const description = String(item.description ?? "").trim();
        const quantity = Number(item.quantity ?? 1);
        if (!description || description.length > 300 || !Number.isFinite(quantity) || quantity <= 0) {
          throw new HttpError(400, "Invalid proposal item");
        }
        return {
          company_id: context.companyId,
          acervo_id: item.acervo_id || null,
          description,
          quantity,
          unit_price: money(item.unit_price),
          unit_cost: money(item.unit_cost),
          image_path: typeof item.image_path === "string" ? item.image_path.slice(0, 500) : null,
          sort_order: index,
        };
      });
      const inventoryIds = [...new Set(normalizedItems.map((item) => item.acervo_id).filter(Boolean))];
      if (inventoryIds.length) {
        const { data: ownedInventory, error: inventoryError } = await context.client.from("acervo")
          .select("id").eq("company_id", context.companyId).in("id", inventoryIds);
        if (inventoryError) throw inventoryError;
        if ((ownedInventory ?? []).length !== inventoryIds.length) throw new HttpError(404, "Inventory item not found");
      }
      const subtotal = normalizedItems.reduce((sum: number, item: ProposalItemInput) => sum + item.quantity * item.unit_price, 0);
      const estimatedCost = normalizedItems.reduce((sum: number, item: ProposalItemInput) => sum + item.quantity * item.unit_cost, 0);
      const discount = money(body.discount);
      if (discount > subtotal) throw new HttpError(400, "Discount exceeds subtotal");

      let version = 1;
      if (body.deal_id) {
        const { data: previous } = await context.client.from("proposals").select("version")
          .eq("deal_id", body.deal_id).order("version", { ascending: false }).limit(1).maybeSingle();
        version = (previous?.version ?? 0) + 1;
      }
      const token = createPublicToken();
      const { data: proposal, error: proposalError } = await context.client.from("proposals").insert({
        company_id: context.companyId,
        deal_id: body.deal_id || null,
        version,
        customer_name: customerName,
        customer_phone: body.customer_phone || null,
        event_date: body.event_date || null,
        event_address: body.event_address || null,
        theme: body.theme || null,
        valid_until: body.valid_until || undefined,
        subtotal: money(subtotal),
        discount,
        total: money(subtotal - discount),
        estimated_cost: money(estimatedCost),
        terms: body.terms || null,
        public_token_hash: await hashPublicToken(token),
        created_by: context.userId,
      }).select().single();
      if (proposalError) throw proposalError;

      const { error: itemsError } = await context.client.from("proposal_items").insert(
        normalizedItems.map((item: ProposalItemInput) => ({ ...item, proposal_id: proposal.id })),
      );
      if (itemsError) {
        await context.client.from("proposals").delete().eq("id", proposal.id);
        throw itemsError;
      }
      await context.client.from("product_events").insert({
        company_id: context.companyId, user_id: context.userId, event_name: "proposal_created",
        properties: { proposal_id: proposal.id },
      });
      return new Response(JSON.stringify({ proposal, token }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send") {
      const token = createPublicToken();
      const { data, error } = await context.client.from("proposals").update({
        status: "sent", sent_at: new Date().toISOString(), public_token_hash: await hashPublicToken(token),
      }).eq("id", body.proposal_id).eq("company_id", context.companyId)
        .in("status", ["draft", "sent", "viewed"]).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(404, "Proposal not found");
      await context.client.from("product_events").insert({
        company_id: context.companyId, user_id: context.userId, event_name: "proposal_sent",
        properties: { proposal_id: data.id },
      });
      return new Response(JSON.stringify({ success: true, token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deposit_received") {
      if (context.role === "staff") throw new HttpError(403, "Manager permission required");
      const { data, error } = await context.client.rpc("confirm_proposal_deposit", {
        p_proposal_id: body.proposal_id,
        p_amount: money(body.amount),
        p_method: body.method || null,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, event_id: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new HttpError(400, "Unsupported action");
  } catch (error) {
    if (!(error instanceof HttpError)) await captureEdgeError(error, "proposal-service", req);
    return errorResponse(error, corsHeaders);
  }
});

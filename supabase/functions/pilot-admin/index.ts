import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, HttpError } from "../_shared/auth.ts";
import { captureEdgeError } from "../_shared/observability.ts";
import { createServiceClient } from "../_shared/service-client.ts";
import { loadSupabaseRequestContext } from "../_shared/supabase-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const context = await loadSupabaseRequestContext(req);
    const service = createServiceClient();
    const { data: admin } = await service.from("platform_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (!admin) throw new HttpError(404, "Resource not found");

    if (req.method === "GET") {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [
        { data: companies },
        { data: subscriptions },
        { data: events },
        { data: profiles },
        { count: errors24h },
        { count: failedEvents24h },
      ] = await Promise.all([
        service.from("companies").select("id, nome, status, is_demo, created_at").order("created_at", { ascending: false }),
        service.from("company_subscriptions").select("*").order("created_at", { ascending: false }),
        service.from("product_events").select("company_id, event_name, occurred_at").gte("occurred_at", new Date(Date.now() - 30 * 864e5).toISOString()),
        service.from("profiles").select("company_id"),
        service.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        service.from("events_queue").select("id", { count: "exact", head: true }).eq("status", "FAILED").gte("created_at", since24h),
      ]);
      const memberCounts = (profiles ?? []).reduce((map: Record<string, number>, profile) => {
        map[profile.company_id] = (map[profile.company_id] ?? 0) + 1;
        return map;
      }, {});
      return new Response(JSON.stringify({
        companies: companies ?? [],
        subscriptions: subscriptions ?? [],
        events: events ?? [],
        member_counts: memberCounts,
        health: { errors_24h: errors24h ?? 0, failed_events_24h: failedEvents24h ?? 0 },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      const body = await req.json();
      const allowedStatus = ["trialing", "active", "past_due", "suspended", "canceled"];
      const updates: Record<string, unknown> = {};
      if (allowedStatus.includes(body?.status)) updates.status = body.status;
      if (["monthly", "annual"].includes(body?.billing_cycle)) updates.billing_cycle = body.billing_cycle;
      if (Number.isInteger(body?.support_minutes) && body.support_minutes >= 0) updates.support_minutes = body.support_minutes;
      if (!Object.keys(updates).length) throw new HttpError(400, "No valid updates");
      const { data, error } = await service.from("company_subscriptions").update(updates)
        .eq("company_id", body.company_id).select().maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(404, "Company not found");
      return new Response(JSON.stringify({ subscription: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new HttpError(405, "Method not allowed");
  } catch (error) {
    if (!(error instanceof HttpError)) await captureEdgeError(error, "pilot-admin", req);
    return errorResponse(error, corsHeaders);
  }
});

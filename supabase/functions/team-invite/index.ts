import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, HttpError } from "../_shared/auth.ts";
import { captureEdgeError } from "../_shared/observability.ts";
import { createPublicToken, hashPublicToken } from "../_shared/public-token.ts";
import { subscriptionCanWrite } from "../_shared/saas-security.ts";
import { createServiceClient } from "../_shared/service-client.ts";
import { loadSupabaseRequestContext } from "../_shared/supabase-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const service = createServiceClient();

    if (req.method === "PUT") {
      const authorization = req.headers.get("Authorization") ?? "";
      if (!/^Bearer\s+\S+$/i.test(authorization)) throw new HttpError(401, "Unauthorized");
      const token = authorization.replace(/^Bearer\s+/i, "");
      const { data: { user }, error: authError } = await service.auth.getUser(token);
      if (authError || !user?.email) throw new HttpError(401, "Unauthorized");
      const body = await req.json();
      if (typeof body?.token !== "string") throw new HttpError(400, "Invalid invitation");

      const { data: invitation } = await service.from("team_invitations").select("*")
        .eq("token_hash", await hashPublicToken(body.token)).eq("status", "pending").maybeSingle();
      if (!invitation || new Date(invitation.expires_at).getTime() <= Date.now()) throw new HttpError(404, "Invitation not found");
      if (invitation.email.toLowerCase() !== user.email.toLowerCase()) throw new HttpError(403, "Invitation belongs to another email");
      const { data: invitedSubscription } = await service.from("company_subscriptions")
        .select("status, trial_ends_at, grace_ends_at").eq("company_id", invitation.company_id).maybeSingle();
      if (!subscriptionCanWrite(invitedSubscription)) throw new HttpError(403, "Subscription is read-only");

      const { count } = await service.from("profiles").select("id", { count: "exact", head: true })
        .eq("company_id", invitation.company_id);
      if ((count ?? 0) >= 3) throw new HttpError(409, "Team limit reached");

      const profilePayload = {
        id: user.id,
        user_id: user.id,
        company_id: invitation.company_id,
        role: invitation.role,
        nome: String(user.user_metadata?.name ?? user.email.split("@")[0]).slice(0, 120),
      };
      const { error: profileError } = await service.from("profiles").upsert(profilePayload, { onConflict: "id" });
      if (profileError) throw profileError;
      const { error: invitationError } = await service.from("team_invitations").update({
        status: "accepted", accepted_by: user.id, accepted_at: new Date().toISOString(),
      }).eq("id", invitation.id).eq("status", "pending");
      if (invitationError) throw invitationError;
      await service.from("product_events").insert({
        company_id: invitation.company_id, user_id: user.id, event_name: "invitation_accepted", properties: {},
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const context = await loadSupabaseRequestContext(req);
    if (context.role !== "owner") throw new HttpError(403, "Owner permission required");

    if (req.method === "GET") {
      const [{ data: invitations }, { data: members }, { data: subscription }] = await Promise.all([
        context.client.from("team_invitations").select("id, email, role, status, expires_at, created_at")
          .order("created_at", { ascending: false }),
        context.client.from("profiles").select("id, nome, role, user_id").eq("company_id", context.companyId),
        context.client.from("company_subscriptions").select("*").eq("company_id", context.companyId).maybeSingle(),
      ]);
      return new Response(JSON.stringify({ invitations: invitations ?? [], members: members ?? [], subscription }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      if (!subscriptionCanWrite(context.subscription ?? null)) throw new HttpError(403, "Subscription is read-only");
      const body = await req.json();
      const email = String(body?.email ?? "").trim().toLowerCase();
      const role = body?.role === "manager" ? "manager" : "staff";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, "Invalid email");
      const { count } = await context.client.from("profiles").select("id", { count: "exact", head: true })
        .eq("company_id", context.companyId);
      if ((count ?? 0) >= 3) throw new HttpError(409, "Team limit reached");

      const token = createPublicToken();
      const { data, error } = await context.client.from("team_invitations").insert({
        company_id: context.companyId, email, role, token_hash: await hashPublicToken(token), invited_by: context.userId,
      }).select("id, email, role, expires_at").single();
      if (error) throw error;
      return new Response(JSON.stringify({ invitation: data, token }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new HttpError(405, "Method not allowed");
  } catch (error) {
    if (!(error instanceof HttpError)) await captureEdgeError(error, "team-invite", req);
    return errorResponse(error, corsHeaders);
  }
});

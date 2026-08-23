import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";
import { authenticateRequest } from "./auth.ts";

export async function loadSupabaseRequestContext(req: Request) {
  return await authenticateRequest(req, async (authorization) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !anonKey) throw new Error("Supabase user client is not configured");

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await client.auth.getUser(token);
    if (userError || !user) return null;

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile?.company_id) return null;

    const { data: company, error: companyError } = await client
      .from("companies")
      .select("is_demo")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (companyError || !company) return null;

    const { data: subscription, error: subscriptionError } = await client
      .from("company_subscriptions")
      .select("status, trial_ends_at, grace_ends_at")
      .eq("company_id", profile.company_id)
      .maybeSingle();
    if (subscriptionError) return null;

    return {
      authorization,
      client,
      userId: user.id,
      companyId: profile.company_id,
      isDemo: company.is_demo === true,
      role: profile.role,
      subscription,
    };
  });
}

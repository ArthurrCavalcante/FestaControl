import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

export function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service client is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, HttpError } from "../_shared/auth.ts";
import { captureEdgeError } from "../_shared/observability.ts";
import { createServiceClient } from "../_shared/service-client.ts";
import { validateTenantBootstrapInput } from "../_shared/tenant-bootstrap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) throw new HttpError(401, "Unauthorized");

    const service = createServiceClient();
    const { data: { user }, error: userError } = await service.auth.getUser(token);
    if (userError || !user) throw new HttpError(401, "Unauthorized");

    const input = validateTenantBootstrapInput(await req.json());
    const { data: companyId, error } = await service.rpc("create_new_tenant_for_user", {
      p_user_id: user.id,
      p_company_name: input.companyName,
      p_user_name: input.userName,
      p_phone: input.phone,
      p_pix_key: input.pixKey,
    });
    if (error) {
      if (/ja pertence|already belongs/i.test(error.message)) throw new HttpError(409, "Usuário já pertence a uma empresa.");
      throw error;
    }

    return new Response(JSON.stringify({ success: true, company_id: companyId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (!(error instanceof HttpError)) await captureEdgeError(error, "tenant-bootstrap", req);
    return errorResponse(error, corsHeaders);
  }
});

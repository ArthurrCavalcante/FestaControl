import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { analyzeConversation } from "../_shared/analyze-conversation.ts";
import { errorResponse, HttpError, requireLiveTenant, requireTenantResource } from "../_shared/auth.ts";
import { loadSupabaseRequestContext } from "../_shared/supabase-auth.ts";
import { captureEdgeError } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const context = await loadSupabaseRequestContext(req);
    const { conversation_id: conversationId } = await req.json();
    if (typeof conversationId !== "string") throw new HttpError(400, "conversation_id is required");

    const { data: conversation, error: conversationError } = await context.client
      .from("conversations")
      .select("id, company_id")
      .eq("id", conversationId)
      .eq("company_id", context.companyId)
      .maybeSingle();
    if (conversationError) throw conversationError;
    requireTenantResource(conversation, context.companyId);
    requireLiveTenant(context);

    const { data: messages, error: messageError } = await context.client
      .from("messages")
      .select("direction, transcription, content")
      .eq("conversation_id", conversationId)
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (messageError) throw messageError;

    const transcript = (messages ?? []).map((message) => {
      const sender = message.direction === "INBOUND" ? "Cliente" : "Atendente";
      const content = message.transcription ? `[Audio/Midia transcrita]: ${message.transcription}` : message.content;
      return `${sender}: ${content ?? ""}`;
    }).join("\n");

    const newState = await analyzeConversation({}, transcript);
    const { error: updateError } = await context.client
      .from("conversations")
      .update({ crm_state: newState })
      .eq("id", conversationId)
      .eq("company_id", context.companyId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, crm_state: newState }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (!(error instanceof HttpError)) await captureEdgeError(error, "recalculate-state", req);
    return errorResponse(error, corsHeaders);
  }
});

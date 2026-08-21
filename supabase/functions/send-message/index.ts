import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { ProviderFactory } from "../_shared/providers/ProviderFactory.ts";
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
    const provider = ProviderFactory.getProviderByName(authorizedConversation.canal);
    if (!provider) throw new HttpError(400, "Unsupported channel");
    const sendResult = await provider.send(authorizedConversation.remetente_id, content, {});

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

    return new Response(JSON.stringify({ success: true, message: newMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (!(error instanceof HttpError)) await captureEdgeError(error, "send-message", req);
    return errorResponse(error, corsHeaders);
  }
});

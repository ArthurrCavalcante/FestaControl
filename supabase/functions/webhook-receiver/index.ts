import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";
import { ProviderFactory } from "../_shared/providers/ProviderFactory.ts";
import { resolveConnectedCompany, verifyMetaSignature } from "../_shared/webhook-security.ts";
import { captureEdgeError } from "../_shared/observability.ts";
import { assertEvolutionWebhookSecret, isUuid, subscriptionCanWrite } from "../_shared/saas-security.ts";
import { getWelcomeReply } from "../_shared/whatsapp-automation.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALLOWED_ORIGINS = [
  'https://FestaControl-crm.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  };
}

/**
 * Resolve a empresa com base no external_id da plataforma (multi-tenant real).
 * O external_id corresponde ao "id" da entrada (entry[0].id) no payload da Meta,
 * que identifica a Page ID ou a Instagram Business Account.
 */
async function resolveCompanyId(platform: string, externalId: string | null): Promise<string | null> {
  return await resolveConnectedCompany(platform, externalId, async (provider, providerId) => {
    const { data: connection } = await supabase
      .from('company_connections')
      .select('company_id')
      .eq('platform', provider)
      .eq('external_id', providerId)
      .maybeSingle();
    return connection?.company_id ?? null;
  });
}

async function resolveActiveEvolutionCompany(instanceId: unknown): Promise<string | null> {
  if (!isUuid(instanceId)) return null;
  const { data: connection } = await supabase.from("company_connections")
    .select("company_id")
    .eq("platform", "evolution")
    .eq("external_id", instanceId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (!connection?.company_id) return null;

  const [{ data: company }, { data: subscription }] = await Promise.all([
    supabase.from("companies").select("status, is_demo").eq("id", connection.company_id).maybeSingle(),
    supabase.from("company_subscriptions").select("status, trial_ends_at, grace_ends_at")
      .eq("company_id", connection.company_id).maybeSingle(),
  ]);
  if (!company || company.is_demo || company.status !== "ACTIVE" || !subscriptionCanWrite(subscription)) return null;
  return connection.company_id;
}

/**
 * Dispara o event-processor de forma assíncrona (fire-and-forget) para não bloquear
 * o retorno imediato que a Meta exige. O secret protege o endpoint de chamadas externas.
 */
async function dispatchEventProcessor(record: Record<string, unknown>): Promise<void> {
  if (!INTERNAL_SECRET) {
    console.warn('webhook-receiver: INTERNAL_FUNCTION_SECRET não configurado. event-processor não será chamado.');
    return;
  }

  const processorUrl = `${supabaseUrl}/functions/v1/event-processor`;
  
  // Fire-and-forget protegido com EdgeRuntime.waitUntil
  // Garante que a Edge Function não morra antes do fetch iniciar a requisição no background
  const fetchPromise = fetch(processorUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'x-internal-secret': INTERNAL_SECRET,
    },
    body: JSON.stringify({ record: { id: record.id } }),
  }).catch(err => {
    console.error('webhook-receiver: Falha ao disparar event-processor:', err.message);
  });

  // @ts-ignore: EdgeRuntime é injetado globalmente pela Supabase
  if (typeof EdgeRuntime !== 'undefined') {
    // @ts-ignore
    EdgeRuntime.waitUntil(fetchPromise);
  } else {
    // Fallback local se não estiver no EdgeRuntime (ex: rodando deno run local)
    await fetchPromise;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Desafio de Verificação (Usado pela Meta/Messenger)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === Deno.env.get('FB_VERIFY_TOKEN')) {
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    // 2. Recebimento de Eventos (POST)
    if (req.method === 'POST') {
      const rawBody = await req.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      const payloadString = decoder.decode(rawBody);
      let payload;
      try {
        payload = JSON.parse(payloadString);
      } catch {
        return new Response('Invalid JSON', { status: 400 });
      }
      
      const isEvolution = payload?.event === 'messages.upsert' || !!payload?.instance;
      const isMeta = Array.isArray(payload?.entry);

      if (!isEvolution && !isMeta) {
        return new Response('Invalid payload format', { status: 400 });
      }

      // Autenticação (Meta HMAC vs Evolution token)
      if (isMeta) {
        const signature = req.headers.get('x-hub-signature-256');
        const appSecret = Deno.env.get('FB_APP_SECRET') ?? '';
        if (!signature || !(await verifyMetaSignature(payloadString, signature, appSecret))) {
          console.warn('Meta Webhook: Unauthorized. Signature mismatch.');
          return new Response('Unauthorized', { status: 401 });
        }
      } else if (isEvolution) {
        assertEvolutionWebhookSecret(
          req.headers.get("x-webhook-secret") ?? req.headers.get("apikey"),
          Deno.env.get("EVOLUTION_WEBHOOK_SECRET") ?? "",
        );
      }

      // Roteamento para o Provider apropriado
      const provider = ProviderFactory.getProvider(req, payload);
      
      if (!provider) {
        console.warn('Nenhum provider encontrado para este payload/header.');
        return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
      }

      let companyId: string | null = null;

      if (isEvolution) {
        companyId = await resolveActiveEvolutionCompany(payload.instance);
      } else {
        // Identificar Empresa via company_connections (multi-tenant real)
        const externalId = payload?.entry?.[0]?.id ?? null;
        companyId = await resolveCompanyId(provider.name, externalId);
      }

      if (!companyId) {
        console.warn('Nenhuma empresa encontrada para este webhook.');
        return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
      }

      const providerKey = provider.name;
      const { data: settings } = await supabase.from("company_settings")
        .select("automations").eq("company_id", companyId).maybeSingle();
      const whatsappAutomation = (settings?.automations as Record<string, unknown> | null)?.whatsapp as Record<string, unknown> | undefined;
      const messages = await provider.receive(req, rawBody, { company_id: companyId });

      for (const msg of messages) {

         // Busca ou cria Conversation baseada no remetente
         let { data: conversation } = await supabase
           .from('conversations')
           .select('*')
           .eq('remetente_id', msg.senderId)
           .eq('canal', providerKey)
           .eq('company_id', companyId)
           .single();

         const isNewConversation = !conversation;
         if (!conversation) {
            const { data: newConv, error: convError } = await supabase
              .from('conversations')
              .insert({
                 company_id: companyId,
                 canal: providerKey,
                 remetente_id: msg.senderId,
                 nome_cliente: `${providerKey} (${msg.senderId.split('@')[0]})`,
                 status: 'NEW',
                 last_message: msg.content,
                 last_activity: new Date().toISOString()
              }).select().single();
            if (convError) throw convError;
            conversation = newConv;
         } else {
            await supabase
              .from('conversations')
              .update({
                 last_message: msg.content,
                 last_activity: new Date().toISOString(),
                 status: 'ACTIVE'
              }).eq('id', conversation.id);
         }

         // Insere a Message (idempotente pelo provider_message_id)
         let messageId = null;
         const { data: existingMsg } = await supabase
            .from('messages')
            .select('id')
            .eq('company_id', companyId)
            .eq('provider_message_id', msg.providerMessageId)
            .maybeSingle();
            
         if (!existingMsg) {
           const { data: insertedMsg, error: msgError } = await supabase.from('messages').insert({
             company_id: companyId,
             conversation_id: conversation.id,
             direction: msg.fromMe ? 'OUTBOUND' : 'INBOUND',
             sender_type: msg.fromMe ? 'AGENT' : 'USER',
             content: msg.content,
             provider_message_id: msg.providerMessageId,
             content_type: msg.mediaType,
             media_url: msg.mediaUrl,
             ai_status: msg.mediaType !== 'TEXT' ? 'PENDING' : 'COMPLETED'
           }).select('id').single();
           
           if (!msgError && insertedMsg) {
             messageId = insertedMsg.id;
             if (!msg.fromMe && isEvolution) {
               await supabase.rpc("record_inbound_message", { p_company_id: companyId });
             }
           }
         } else {
           messageId = existingMsg.id;
         }

         // Emite evento e dispara o processor de forma assíncrona
         if (messageId && conversation) {
           const eventRecord = {
             company_id: companyId,
             type: msg.fromMe ? 'message.sent' : 'message.received',
             payload: {
               message_id: messageId,
               conversation_id: conversation.id,
               content: msg.content
             },
             status: 'PENDING'
           };

           const { data: queuedEvent } = await supabase
             .from('events_queue')
             .insert(eventRecord)
             .select()
             .single();

           // Dispara o event-processor (fire-and-forget) — conecta a fila ao processador
           if (queuedEvent) {
             await dispatchEventProcessor(queuedEvent);
           }
         }

         const welcomeReply = getWelcomeReply(whatsappAutomation ?? {}, { isNewConversation, fromMe: msg.fromMe === true });
         if (welcomeReply && conversation) {
           try {
             const sent = await provider.send(msg.senderId, welcomeReply, { company_id: companyId });
             await supabase.from("messages").insert({
               company_id: companyId,
               conversation_id: conversation.id,
               direction: "OUTBOUND",
               sender_type: "AGENT",
               content: welcomeReply,
               content_type: "TEXT",
               provider_message_id: sent.providerMessageId,
             });
             await supabase.from("conversations").update({
               last_message: welcomeReply,
               last_activity: new Date().toISOString(),
             }).eq("id", conversation.id).eq("company_id", companyId);
             await supabase.rpc("record_whatsapp_delivery", { p_company_id: companyId, p_success: true });
             await supabase.from("product_events").insert({
               company_id: companyId,
               user_id: null,
               event_name: "whatsapp_auto_reply_sent",
               properties: { provider: providerKey, automation: "welcome" },
             });
           } catch (automationError) {
             await supabase.rpc("record_whatsapp_delivery", { p_company_id: companyId, p_success: false });
             console.error("webhook-receiver: automatic welcome failed", automationError instanceof Error ? automationError.message : "unknown error");
           }
         }
      }

      return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
    }
  } catch (e) {
    if (e instanceof Error && e.name === "HttpError") {
      const status = (e as Error & { status?: number }).status ?? 401;
      return new Response(status === 503 ? "Webhook not configured" : "Unauthorized", { status });
    }
    await captureEdgeError(e, 'webhook-receiver', req);
    return new Response('Internal Server Error', { status: 500 });
  }

  return new Response('Method not allowed', { status: 405 });
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ProviderFactory } from "../_shared/providers/ProviderFactory.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALLOWED_ORIGINS = [
  'https://festaflow-crm.vercel.app',
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

// Utils para validação HMAC da Meta
async function verifyMetaSignature(payload: string, signature: string): Promise<boolean> {
  const secret = Deno.env.get('FB_APP_SECRET');
  if (!secret) return false;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['verify']
  );
  
  const sigHex = signature.replace('sha256=', '');
  const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
}

/**
 * Resolve a empresa com base no external_id da plataforma (multi-tenant real).
 * O external_id corresponde ao "id" da entrada (entry[0].id) no payload da Meta,
 * que identifica a Page ID ou a Instagram Business Account.
 *
 * Fallback para a primeira empresa cadastrada quando a tabela company_connections
 * ainda está vazia (modo single-tenant / setup inicial).
 */
async function resolveCompanyId(platform: string, externalId: string | null): Promise<string | null> {
  if (externalId) {
    const { data: connection } = await supabase
      .from('company_connections')
      .select('company_id')
      .eq('platform', platform)
      .eq('external_id', externalId)
      .single();

    if (connection?.company_id) {
      return connection.company_id;
    }
  }

  // Fallback: single-tenant / sem conexão cadastrada ainda
  console.warn(`webhook-receiver: Nenhuma company_connection encontrada para ${platform}/${externalId}. Usando fallback single-tenant.`);
  const { data: company } = await supabase.from('companies').select('id').limit(1).single();
  return company?.id ?? null;
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
  
  // Fire-and-forget: não aguardamos a resposta para não bloquear o retorno ao webhook da Meta
  fetch(processorUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'x-internal-secret': INTERNAL_SECRET,
    },
    body: JSON.stringify({ record }),
  }).catch(err => {
    console.error('webhook-receiver: Falha ao disparar event-processor:', err.message);
  });
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
      } catch (e) {
        return new Response('Invalid JSON', { status: 400 });
      }

      // Autenticação Meta HMAC
      const signature = req.headers.get('x-hub-signature-256');
      if (!signature || !(await verifyMetaSignature(payloadString, signature))) {
        console.warn('Meta Webhook: Unauthorized. Signature mismatch.');
        return new Response('Unauthorized', { status: 401 });
      }

      // Roteamento para o Provider apropriado
      const provider = ProviderFactory.getProvider(req, payload);
      
      if (!provider) {
        console.warn('Nenhum provider encontrado para este payload/header.');
        return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
      }

      // Identificar Empresa via company_connections (multi-tenant real)
      // O external_id corresponde ao ID da entrada (entry[0].id) no payload da Meta
      const externalId = payload?.entry?.[0]?.id ?? null;
      const companyId = await resolveCompanyId(provider.name, externalId);

      if (!companyId) {
        console.warn('Nenhuma empresa encontrada para este webhook.');
        return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
      }

      const providerKey = provider.name;
      const messages = await provider.receive(req, rawBody, {});

      for (const msg of messages) {

         // Busca ou cria Conversation baseada no remetente
         let { data: conversation } = await supabase
           .from('conversations')
           .select('*')
           .eq('remetente_id', msg.senderId)
           .eq('canal', providerKey)
           .eq('company_id', companyId)
           .single();

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
            .eq('provider_message_id', msg.providerMessageId)
            .single();
            
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
      }

      return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
    }
  } catch (e) {
    console.error('Webhook processing error');
    return new Response('Internal Server Error', { status: 500 });
  }

  return new Response('Method not allowed', { status: 405 });
});

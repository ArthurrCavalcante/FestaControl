import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ProviderFactory } from "../_shared/providers/ProviderFactory.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

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

serve(async (req) => {
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

      // Identificar Empresa (atualmente single-tenant de fato)
      const { data: company } = await supabase.from('companies').select('id').limit(1).single();
      if (!company) {
        console.warn('Nenhuma empresa encontrada.');
        return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
      }
      const companyId = company.id;

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

         // Insere a Message
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

         // Emite evento caso seja uma mensagem nova
         if (messageId && conversation) {
           await supabase.from('events_queue').insert({
             company_id: companyId,
             type: msg.fromMe ? 'message.sent' : 'message.received',
             payload: {
               message_id: messageId,
               conversation_id: conversation.id,
               content: msg.content
             },
             status: 'PENDING'
           });
         }
      }

      return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
    }
  } catch (e) {
    console.error(e);
    return new Response('Internal Server Error', { status: 500 });
  }

  return new Response('Method not allowed', { status: 405 });
});

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ProviderFactory } from "../_shared/providers/ProviderFactory.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // 1. Verificação / Handshake inicial (Facebook/WhatsApp compartilham o mesmo handshake da Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const VERIFY_TOKEN = Deno.env.get('FB_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // 2. Recepção de Mensagens
  if (req.method === 'POST') {
    try {
      const rawBody = await req.arrayBuffer();
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Usar o decoder apenas para descobrir o provider inicial, 
      // a verificação real ocorre dentro de cada provider com o rawBody
      const bodyText = new TextDecoder('utf-8').decode(rawBody);
      const body = JSON.parse(bodyText);

      const provider = ProviderFactory.getProviderForPayload(body);
      if (!provider) {
         return new Response('Provider unsupported or not mapped', { status: 404 });
      }
      
      const providerKey = provider.name;

      // Deixa o provider fazer o parse da mensagem de forma padronizada
      const messages = await provider.receive(req, rawBody, {});

      for (const msg of messages) {
         // Identificar Empresa
         const { data: conn } = await supabase
           .from('company_connections')
           .select('company_id')
           .eq('external_id', msg.recipientId)
           .eq('provider', providerKey)
           .single();

         if (!conn) {
           console.warn(`Mensagem recebida de recipient ${msg.recipientId} não mapeada para nenhuma empresa.`);
           continue;
         }
         
         const companyId = conn.company_id;

         // Busca ou cria Conversation
         let { data: conversation } = await supabase
           .from('conversations')
           .select('*')
           .eq('remetente_id', msg.senderId)
           .eq('company_id', companyId)
           .single();

         if (!conversation) {
            const { data: newConv, error: convError } = await supabase
              .from('conversations')
              .insert({
                 company_id: companyId,
                 canal: providerKey,
                 remetente_id: msg.senderId,
                 nome_cliente: `Cliente ${providerKey} (${msg.senderId.substring(0,4)})`,
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
             direction: 'INBOUND',
             sender_type: 'USER',
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

         // Event Bus: Notifica que uma mensagem chegou
         if (messageId && conversation) {
           await supabase.from('events_queue').insert({
             company_id: companyId,
             type: 'message.received',
             payload: {
               message_id: messageId,
               conversation_id: conversation.id,
               content: msg.content,
               media_type: msg.mediaType,
               media_url: msg.mediaUrl
             },
             status: 'PENDING'
           });
         }
      }

      return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });

    } catch (e) {
      console.error(e);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});

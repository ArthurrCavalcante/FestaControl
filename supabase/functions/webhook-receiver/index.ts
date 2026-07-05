import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifySignature(appSecret: string, signature: string, rawBody: ArrayBuffer) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', 
    enc.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, 
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, rawBody);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const expectedSignature = 'sha256=' + hashHex;
  
  // Comparação em tempo constante (evita timing attacks)
  if (expectedSignature.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // 1. Verificação / Handshake inicial com a Meta
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const VERIFY_TOKEN = Deno.env.get('FB_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // 2. Recepção de Mensagens
  if (req.method === 'POST') {
    try {
      const APP_SECRET = Deno.env.get('FB_APP_SECRET');
      const signature = req.headers.get('x-hub-signature-256');

      if (!signature || !APP_SECRET) {
        return new Response('Missing signature or secret', { status: 401 });
      }

      // IMPORTANTE: Leitura do raw body ANTES do parse JSON para o HMAC bater perfeitamente
      const rawBody = await req.arrayBuffer();
      
      const isValid = await verifySignature(APP_SECRET, signature, rawBody);

      if (!isValid) {
         console.error('Invalid signature. Request rejected.');
         return new Response('Invalid signature', { status: 401 });
      }

      // Corpo validado. Agora podemos converter para JSON de forma segura.
      const decoder = new TextDecoder('utf-8');
      const bodyText = decoder.decode(rawBody);
      const body = JSON.parse(bodyText);

      // Instanciando cliente com SERVICE_ROLE para bypass da RLS no webhook
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      if (body.object === 'page') {
        for (const entry of body.entry) {
          if (!entry.messaging) continue;
          
          const webhook_event = entry.messaging[0];
          const sender_psid = webhook_event.sender.id;
          
          if (webhook_event.message && webhook_event.message.text) {
             const messageText = webhook_event.message.text;
             const providerMessageId = webhook_event.message.mid;
             
             // Message Service Layer: 
             // 1. Busca ou cria Conversation
             let { data: conversation } = await supabase
               .from('conversations')
               .select('*')
               .eq('remetente_id', sender_psid)
               .single();

             if (!conversation) {
                // Busca o nome real do cliente na Graph API do Facebook
                let clientName = `Cliente FB (${sender_psid.substring(0,4)})`;
                const PAGE_ACCESS_TOKEN = Deno.env.get('FB_PAGE_ACCESS_TOKEN');
                if (PAGE_ACCESS_TOKEN) {
                  try {
                    const profileResp = await fetch(`https://graph.facebook.com/v19.0/${sender_psid}?fields=first_name,last_name&access_token=${PAGE_ACCESS_TOKEN}`);
                    if (profileResp.ok) {
                      const profile = await profileResp.json();
                      if (profile.first_name || profile.last_name) {
                        clientName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
                      }
                    }
                  } catch (e) {
                    console.error('Erro ao buscar perfil do usuário no Facebook:', e);
                  }
                }

                const { data: newConv, error: convError } = await supabase
                  .from('conversations')
                  .insert({
                     canal: 'facebook',
                     remetente_id: sender_psid,
                     nome_cliente: clientName,
                     status: 'OPEN',
                     last_message: messageText,
                     last_activity: new Date().toISOString()
                  }).select().single();
                  
                if (convError) throw convError;
                conversation = newConv;
             } else {
                // Se já existe, atualiza a última atividade
                await supabase
                  .from('conversations')
                  .update({
                     last_message: messageText,
                     last_activity: new Date().toISOString(),
                     status: 'OPEN'
                  }).eq('id', conversation.id);
             }

             // 2. Insere a Message associada
             if (conversation) {
               // Verifica duplicidade básica pelo provider_message_id (se tiver)
               const { data: existingMsg } = await supabase
                  .from('messages')
                  .select('id')
                  .eq('provider_message_id', providerMessageId)
                  .single();
                  
               if (!existingMsg) {
                 await supabase.from('messages').insert({
                   conversation_id: conversation.id,
                   direction: 'INBOUND',
                   content: messageText,
                   provider_message_id: providerMessageId
                 });
               }
             }
          }
        }
        return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
      } else {
        return new Response('NOT_FOUND', { status: 404 });
      }

    } catch (e) {
      console.error(e);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});

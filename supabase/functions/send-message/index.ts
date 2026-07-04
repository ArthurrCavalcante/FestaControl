import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Receber Payload
    const { conversation_id, content } = await req.json();

    if (!conversation_id || !content) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 2. Autenticação Padrão (Verifica JWT do Supabase via authorization header que veio do Frontend)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders });
    }

    // Instancia o cliente do Supabase usando a SERVICE_ROLE_KEY para verificar o token com segurança
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validar sessão do usuário extraindo o token manualmente
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Erro de Autenticação JWT:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401, headers: corsHeaders });
    }

    // 3. Buscar Dados da Conversa (Canal e Remetente)
    // Para bypassar RLS se necessário durante a busca estrutural:
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('remetente_id, canal')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404, headers: corsHeaders });
    }

    // 4. Identificar o Provedor e Disparar a Mensagem
    let providerMessageId = null;

    if (conversation.canal === 'facebook') {
      const PAGE_ACCESS_TOKEN = Deno.env.get('FB_PAGE_ACCESS_TOKEN');
      
      if (!PAGE_ACCESS_TOKEN) {
         throw new Error('FB_PAGE_ACCESS_TOKEN not configured in Supabase Secrets');
      }

      const fbResponse = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: conversation.remetente_id },
          message: { text: content }
        })
      });

      const fbResult = await fbResponse.json();

      if (!fbResponse.ok) {
        console.error('Meta API Error:', fbResult);
        throw new Error(`Meta API error: ${fbResult.error?.message || 'Unknown error'}`);
      }

      providerMessageId = fbResult.message_id;
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported channel' }), { status: 400, headers: corsHeaders });
    }

    // 5. Salvar a Mensagem Enviada (OUTBOUND) no Banco
    const { data: newMsg, error: insertError } = await supabaseAdmin.from('messages').insert({
      conversation_id,
      direction: 'OUTBOUND',
      content,
      provider_message_id: providerMessageId
    }).select().single();

    if (insertError) throw insertError;

    // Atualiza last_activity
    await supabaseAdmin.from('conversations').update({
      last_message: content,
      last_activity: new Date().toISOString()
    }).eq('id', conversation_id);

    // Retorna Sucesso
    return new Response(JSON.stringify({ success: true, message: newMsg }), { 
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Send Message Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

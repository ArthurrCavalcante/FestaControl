import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ProviderFactory } from "../_shared/providers/ProviderFactory.ts";

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
    const { conversation_id, content } = await req.json();

    if (!conversation_id || !content) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401, headers: corsHeaders });
    }

    // Buscar Dados da Conversa (Canal, Remetente e Empresa)
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('remetente_id, canal, company_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404, headers: corsHeaders });
    }

    // Evolution (single-tenant) não usa company_connections por enquanto.
    // metadata = {} vazio pois as credenciais estão no Deno.env no provider.
    const metadata = {};

    const provider = ProviderFactory.getProviderByName(conversation.canal);

    if (!provider) {
      return new Response(JSON.stringify({ error: 'Unsupported channel' }), { status: 400, headers: corsHeaders });
    }

    // Disparar Mensagem pelo Provider
    const sendResult = await provider.send(conversation.remetente_id, content, metadata);

    // Salvar a Mensagem Enviada (OUTBOUND) no Banco
    const { data: newMsg, error: insertError } = await supabaseAdmin.from('messages').insert({
      company_id: conversation.company_id,
      conversation_id,
      direction: 'OUTBOUND',
      sender_type: 'HUMAN',
      content,
      provider_message_id: sendResult.providerMessageId
    }).select().single();

    if (insertError) throw insertError;

    // Atualiza last_activity
    await supabaseAdmin.from('conversations').update({
      last_message: content,
      last_activity: new Date().toISOString()
    }).eq('id', conversation_id);

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

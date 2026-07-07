import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { analyzeConversation } from "../_shared/analyze-conversation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { conversation_id } = await req.json();
    
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: 'conversation_id is required' }), { status: 400, headers: corsHeaders });
    }

    // 1. Fetch last 100 messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (msgError) throw msgError;

    // 2. Build Transcript
    let transcript = '';
    for (const msg of messages) {
      const sender = msg.direction === 'INBOUND' ? 'Cliente' : 'Atendente';
      const content = msg.transcription ? `[Áudio/Mídia transcrita]: ${msg.transcription}` : msg.content;
      transcript += `${sender}: ${content}\n`;
    }

    // 3. Analyze Conversation (pass empty state to rebuild)
    const newState = await analyzeConversation({}, transcript);

    // 4. Update Conversation CRM State
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ crm_state: newState })
      .eq('id', conversation_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, crm_state: newState }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

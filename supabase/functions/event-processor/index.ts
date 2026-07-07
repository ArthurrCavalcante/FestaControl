import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { analyzeConversation } from "../_shared/analyze-conversation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function downloadMediaAsBase64(url: string): Promise<{ base64: string, mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar mídia: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = base64Encode(arrayBuffer);
  const mimeType = response.headers.get('content-type') || 'application/octet-stream';
  return { base64, mimeType };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    const record = payload.record || payload; 
    
    if (!record || !record.id || !record.company_id) {
      return new Response('Invalid payload', { status: 400 });
    }

    const { id: eventId, company_id: companyId, type: eventType, payload: eventData } = record;
    await supabase.from('events_queue').update({ status: 'PROCESSING' }).eq('id', eventId);

    if (eventType === 'MESSAGE_RECEIVED') {
      const messageText = eventData.content || '';
      const mediaType = eventData.media_type || 'TEXT';
      const mediaUrl = eventData.media_url;
      const messageId = eventData.message_id;
      const conversationId = eventData.conversation_id;
      
      const { data: runLog } = await supabase.from('automation_runs').insert({
        company_id: companyId,
        event_id: eventId,
        automation_name: 'CRM State Updater',
        status: 'RUNNING'
      }).select('id').single();

      try {
        let mediaPayload;
        if ((mediaType === 'AUDIO' || mediaType === 'IMAGE') && mediaUrl) {
          if (messageId) {
             await supabase.from('messages').update({ ai_status: 'PROCESSING' }).eq('id', messageId);
          }
          mediaPayload = await downloadMediaAsBase64(mediaUrl);
        }

        // Fetch current CRM state
        const { data: conv } = await supabase.from('conversations').select('crm_state').eq('id', conversationId).single();
        const oldState = conv?.crm_state || {};

        // Analyze
        const newState = await analyzeConversation(oldState, messageText, mediaPayload);

        // Update Messages (transcription)
        if (messageId) {
          await supabase.from('messages').update({
            transcription: newState.transcricao || null,
            intent: newState.intencao || null,
            ai_confidence: newState.confidence || 0,
            ai_status: 'COMPLETED'
          }).eq('id', messageId);
          
          // Remove transcricao before saving state to conversation
          delete newState.transcricao;
        }

        // Update Conversations with new CRM state
        await supabase.from('conversations').update({ crm_state: newState }).eq('id', conversationId);

        // State Diff Engine
        let inboxMessage = null;
        let priority = 'NORMAL';

        if (newState.intencao === 'PURCHASE' && oldState.intencao !== 'PURCHASE') {
          inboxMessage = '🔥 Cliente demonstrou intenção de compra';
          priority = 'HIGH';
        } else if (newState.objecao && (!oldState.objecao || oldState.objecao.message !== newState.objecao.message)) {
          inboxMessage = `⚠️ Cliente apresentou objeção: ${newState.objecao.type}`;
          priority = 'HIGH';
        } else if (newState.evento?.data && !oldState.evento?.data) {
          inboxMessage = '📅 Cliente informou a data da festa';
        }

        if (inboxMessage) {
          await supabase.from('inbox_tasks').insert({
            company_id: companyId,
            type: 'AI_REVIEW',
            status: 'PENDING',
            priority: priority,
            payload: {
              conversation_id: conversationId,
              message_id: messageId,
              summary: inboxMessage,
              intent: newState.intencao,
              crm_state: newState
            }
          });
        }

        await supabase.from('automation_runs').update({
          status: 'SUCCESS',
          finished_at: new Date().toISOString()
        }).eq('id', runLog.id);

        await supabase.from('events_queue').update({ 
          status: 'COMPLETED',
          processed_at: new Date().toISOString() 
        }).eq('id', eventId);

      } catch (err) {
        if (runLog) {
          await supabase.from('automation_runs').update({
            status: 'ERROR',
            error_message: err.message,
            finished_at: new Date().toISOString()
          }).eq('id', runLog.id);
        }
        if (messageId) {
           await supabase.from('messages').update({ ai_status: 'ERROR' }).eq('id', messageId);
        }
        await supabase.from('events_queue').update({ status: 'FAILED', error: err.message }).eq('id', eventId);
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

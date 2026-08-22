import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";
import { analyzeConversation } from "../_shared/analyze-conversation.ts";
import { MediaService } from "../_shared/services/MediaService.ts";
import { captureEdgeError } from "../_shared/observability.ts";

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Secret compartilhado com webhook-receiver para garantir que só chamadas internas
// (do próprio sistema) conseguem acionar o event-processor.
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET');

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Autenticação por segredo interno — bloqueia qualquer requisição externa
  const incomingSecret = req.headers.get('x-internal-secret');
  if (!INTERNAL_SECRET || incomingSecret !== INTERNAL_SECRET) {
    console.warn('event-processor: Unauthorized request. Missing or invalid x-internal-secret.');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await req.json();
    const requestedRecord = payload.record || payload;
    
    if (!requestedRecord || typeof requestedRecord.id !== 'string') {
      return new Response('Invalid payload', { status: 400 });
    }

    const { data: record, error: eventError } = await supabase
      .from('events_queue')
      .select('id, company_id, type, payload, status')
      .eq('id', requestedRecord.id)
      .maybeSingle();
    if (eventError || !record) return new Response('Event not found', { status: 404 });

    const { id: eventId, company_id: companyId, type: eventType, payload: eventData } = record;
    const { data: company } = await supabase.from('companies').select('is_demo').eq('id', companyId).maybeSingle();
    if (!company) return new Response('Event not found', { status: 404 });
    if (company.is_demo) {
      await supabase.from('events_queue').update({ status: 'FAILED', error: 'External actions disabled for demo tenant' }).eq('id', eventId);
      return new Response(JSON.stringify({ error: 'External actions are disabled for demo tenants' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await supabase.from('events_queue').update({ status: 'PROCESSING' }).eq('id', eventId);

    // Event Bus Router
    if (eventType === 'message.received' || eventType === 'MESSAGE_RECEIVED') {
      const messageText = eventData.content || '';
      const mediaType = eventData.media_type || 'TEXT';
      const mediaUrl = eventData.media_url;
      const messageId = eventData.message_id;
      const conversationId = eventData.conversation_id;

      if (typeof conversationId !== 'string') return new Response('Invalid event', { status: 400 });
      const { data: conv } = await supabase
        .from('conversations')
        .select('crm_state')
        .eq('id', conversationId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (!conv) return new Response('Event not found', { status: 404 });
      if (messageId) {
        const { data: message } = await supabase
          .from('messages')
          .select('id')
          .eq('id', messageId)
          .eq('company_id', companyId)
          .eq('conversation_id', conversationId)
          .maybeSingle();
        if (!message) return new Response('Event not found', { status: 404 });
      }
      
      const { data: runLog } = await supabase.from('automation_runs').insert({
        company_id: companyId,
        event_id: eventId,
        automation_name: 'CRM State Updater',
        status: 'RUNNING'
      }).select('id').single();

      try {
        let mediaPayload;
        if ((mediaType === 'AUDIO' || mediaType === 'IMAGE' || mediaType === 'VIDEO') && mediaUrl) {
          if (messageId) {
             await supabase.from('messages').update({ ai_status: 'PROCESSING' }).eq('id', messageId);
          }
          mediaPayload = await MediaService.downloadAndEncode(mediaUrl);
        }

        // Fetch current CRM state
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

        // State Diff Engine — gera tarefas no inbox quando o estado muda significativamente
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

        if (runLog) {
          await supabase.from('automation_runs').update({
            status: 'SUCCESS',
            finished_at: new Date().toISOString()
          }).eq('id', runLog.id);
        }

        await supabase.from('events_queue').update({ 
          status: 'COMPLETED',
          processed_at: new Date().toISOString() 
        }).eq('id', eventId);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown processing error';
        if (runLog) {
          await supabase.from('automation_runs').update({
            status: 'ERROR',
            error_message: errorMessage,
            finished_at: new Date().toISOString()
          }).eq('id', runLog.id);
        }
        if (messageId) {
           await supabase.from('messages').update({ ai_status: 'ERROR' }).eq('id', messageId);
        }
        await supabase.from('events_queue').update({ status: 'FAILED', error: errorMessage }).eq('id', eventId);
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    await captureEdgeError(error, 'event-processor', req);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: corsHeaders });
  }
});

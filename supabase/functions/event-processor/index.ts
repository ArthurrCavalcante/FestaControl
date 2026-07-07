import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

async function downloadMediaAsBase64(url: string): Promise<{ base64: string, mimeType: string }> {
  // Nota: Em produção real, se o link for do WhatsApp ou FB requer token no cabeçalho.
  // Como as URLs temporárias de attachments do Messenger costumam ser públicas (CDN), fetch direto funciona.
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar mídia: ${response.statusText}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const base64 = base64Encode(arrayBuffer);
  const mimeType = response.headers.get('content-type') || 'application/octet-stream';
  
  return { base64, mimeType };
}

async function callGemini(messageText: string, mediaPayload?: { base64: string, mimeType: string }) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada');

  const prompt = `Você é um assistente de CRM de locação de festas infantis.
Analise a entrada do cliente (que pode ser texto, áudio ou imagem).
1. Se for áudio, forneça a transcrição exata na chave "transcricao".
2. Se for imagem, descreva o tema e detalhes na chave "transcricao".
3. Gere um resumo em 1 linha focada no que o cliente quer ("resumo").
4. Classifique a intenção ("intencao") como: PRICE (quer saber preço), PURCHASE (quer fechar/reservar), QUESTION (dúvida aleatória), COMPLAINT (reclamação).
5. Extraia os dados estruturados: Nome, Tema, Data, Telefone.
Responda APENAS um objeto JSON válido, sem markdown, no formato:
{"transcricao": "...", "resumo": "...", "intencao": "PURCHASE", "nome": "...", "tema": "...", "data": "...", "telefone": "...", "confianca": 95, "motivo_inseguranca": "..."}
A confiança (0 a 100) deve refletir a clareza dos dados extraídos. Se menor que 90, preencha o "motivo_inseguranca".
Mensagem do cliente em texto (se houver): "${messageText}"`;

  const parts = [{ text: prompt }];

  if (mediaPayload) {
    parts.push({
      inlineData: {
        mimeType: mediaPayload.mimeType,
        data: mediaPayload.base64
      }
    } as any);
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text || '{}');
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
      
      const { data: runLog } = await supabase.from('automation_runs').insert({
        company_id: companyId,
        event_id: eventId,
        automation_name: 'Media Pipeline & Routing',
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

        const extractions = await callGemini(messageText, mediaPayload);

        // Atualiza a Message com a inteligência gerada
        if (messageId) {
          await supabase.from('messages').update({
            transcription: extractions.transcricao || null,
            intent: extractions.intencao || null,
            ai_confidence: extractions.confianca || 0,
            ai_status: 'COMPLETED'
          }).eq('id', messageId);
        }

        // Criar tarefa na Inbox para revisão humana
        await supabase.from('inbox_tasks').insert({
          company_id: companyId,
          type: 'AI_REVIEW',
          status: 'PENDING',
          priority: extractions.confianca < 90 ? 'HIGH' : 'NORMAL',
          payload: {
            conversation_id: eventData.conversation_id,
            message_id: messageId,
            media_type: mediaType,
            confidence: extractions.confianca || 0,
            uncertainty_reason: extractions.motivo_inseguranca || null,
            summary: extractions.resumo || null,
            intent: extractions.intencao || null,
            extracted: {
              nome: extractions.nome,
              tema: extractions.tema,
              data: extractions.data,
              telefone: extractions.telefone
            }
          }
        });

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

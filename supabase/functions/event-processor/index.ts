import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações e chaves do Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

async function callGemini(message: string) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada');

  const prompt = `Você é um assistente de CRM de locação de festas infantis.
Extraia os seguintes dados desta mensagem do cliente:
Nome do cliente, Tema da festa (se houver), Data da festa (se houver), Telefone (se houver).
Responda APENAS um objeto JSON válido, sem markdown, no formato:
{"nome": "...", "tema": "...", "data": "...", "telefone": "...", "confianca": 95, "motivo_inseguranca": "..."}
A confiança deve ser de 0 a 100 baseada na clareza dos dados. Se a confiança for menor que 90, preencha o "motivo_inseguranca" (ex: "Não encontrei o mês da festa").
Mensagem: "${message}"`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
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
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // Suporte ao formato de Webhook do banco de dados do Supabase
    const record = payload.record || payload; 
    
    if (!record || !record.id || !record.company_id) {
      return new Response('Invalid payload', { status: 400 });
    }

    const { id: eventId, company_id: companyId, type: eventType, payload: eventData } = record;

    // Atualiza status para PROCESSING
    await supabase.from('events_queue').update({ status: 'PROCESSING' }).eq('id', eventId);

    if (eventType === 'MESSAGE_RECEIVED') {
      const messageText = eventData.content;
      
      // 1. Log Start
      const { data: runLog } = await supabase.from('automation_runs').insert({
        company_id: companyId,
        event_id: eventId,
        automation_name: 'AI Extraction & Routing',
        status: 'RUNNING'
      }).select('id').single();

      try {
        // 2. IA Extraction
        const extractions = await callGemini(messageText);

        // 3. Buscar Regras da Empresa
        const { data: settings } = await supabase
          .from('company_settings')
          .select('automations')
          .eq('company_id', companyId)
          .single();
          
        const leadMode = settings?.automations?.lead_creation?.mode || 'manual';

        // 4. Lógica de Roteamento (Routing) -> Tudo passa pela Inbox primeiro
        
        // Em um sistema real, poderíamos até pular a Inbox se "automatic" e confianca alta, 
        // mas o usuário prefere manter o controle e o log na Inbox.
        // Criar tarefa na Inbox para revisão humana:
        await supabase.from('inbox_tasks').insert({
          company_id: companyId,
          type: 'AI_REVIEW',
          status: 'PENDING',
          priority: extractions.confianca < 90 ? 'HIGH' : 'NORMAL',
          payload: {
            conversation_id: eventData.conversation_id,
            message_id: eventData.message_id,
            confidence: extractions.confianca || 0,
            uncertainty_reason: extractions.motivo_inseguranca || null,
            extracted: {
              nome: extractions.nome,
              tema: extractions.tema,
              data: extractions.data,
              telefone: extractions.telefone
            }
          }
        });
        
        // Se quisermos criar automaticamente sem passar por tela, faríamos aqui 
        // a checagem if (leadMode === 'automatic' && confianca >= 90) { ... }
        // mas como definido, a Fila de Revisão centraliza isso.

        // 5. Sucesso Final
        await supabase.from('automation_runs').update({
          status: 'SUCCESS',
          finished_at: new Date().toISOString()
        }).eq('id', runLog.id);

        await supabase.from('events_queue').update({ 
          status: 'COMPLETED',
          processed_at: new Date().toISOString() 
        }).eq('id', eventId);

      } catch (err) {
        // Log Error
        if (runLog) {
          await supabase.from('automation_runs').update({
            status: 'ERROR',
            error_message: err.message,
            finished_at: new Date().toISOString()
          }).eq('id', runLog.id);
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

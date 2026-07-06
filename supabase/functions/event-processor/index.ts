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
Nome do cliente, Tema da festa (se houver), Data da festa (se houver).
Responda APENAS um objeto JSON válido, sem markdown, no formato:
{"nome": "Nome extraído ou nulo", "tema": "Tema ou nulo", "data": "Data ou nulo", "confianca": 95}
A confiança deve ser de 0 a 100 baseada na clareza dos dados.
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

        // 4. Lógica de Roteamento (Routing)
        if (leadMode === 'automatic' && extractions.confianca >= 90) {
           // Exemplo de criação automática de Lead
           const { data: lead } = await supabase.from('leads').insert({
             company_id: companyId,
             nome: extractions.nome || 'Cliente (Automação)',
             origem: eventData.platform || 'webhook'
           }).select('id').single();

           if (lead && extractions.tema && extractions.data) {
             // Cria Deal se tivermos as informações vitais
             await supabase.from('deals').insert({
               company_id: companyId,
               lead_id: lead.id,
               status_funil: 'NOVOS',
               tema: extractions.tema,
               data_festa: extractions.data
             });
           }
        } 
        else if (leadMode === 'semi_auto' || (leadMode === 'automatic' && extractions.confianca < 90)) {
           // Aqui entrará a Fila de Revisão. Como ainda não temos tabela 'pendencies', 
           // logamos a extração para revisão manual.
           console.log("Requer revisão manual. Dados extraídos:", extractions);
        }

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

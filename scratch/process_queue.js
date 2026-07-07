import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQueue() {
  console.log('Verificando fila de eventos...');
  const { data: events, error } = await supabase
    .from('events_queue')
    .select('*')
    .eq('status', 'PENDING');

  if (error) {
    console.error('Erro ao buscar eventos:', error);
    return;
  }

  console.log(`Encontrados ${events.length} eventos pendentes.`);

  for (const event of events) {
    console.log(`Processando evento ID: ${event.id}...`);
    
    // Simula a chamada que o Webhook do Supabase faria para a Edge Function
    const payload = {
      type: 'INSERT',
      table: 'events_queue',
      schema: 'public',
      record: event
    };

    try {
      const { data, error: fnError } = await supabase.functions.invoke('event-processor', {
        body: payload
      });
      
      if (fnError) {
        console.error(`Erro ao invocar Edge Function para o evento ${event.id}:`, fnError);
      } else {
        console.log(`Edge Function retornou com sucesso para o evento ${event.id}:`, data);
      }
    } catch (e) {
      console.error(`Exceção ao chamar função para evento ${event.id}:`, e.message);
    }
  }
}

checkQueue();

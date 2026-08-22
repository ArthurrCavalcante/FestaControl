import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env ou .env.local manualmente para evitar dependências adicionais
const envPath = fs.existsSync(path.resolve(process.cwd(), '.env.local')) 
  ? path.resolve(process.cwd(), '.env.local')
  : path.resolve(process.cwd(), '.env');

const envConfig = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      value = value.trim();
      // Remove aspas se houver
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      envConfig[match[1]] = value;
    }
  });
}

const supabaseUrl = envConfig.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runScenario(scenarioNum, type, content, mediaUrl = null) {
  console.log(`\n========================================`);
  console.log(`🚀 INICIANDO CENÁRIO ${scenarioNum}: ${type}`);
  console.log(`Conteúdo: "${content}"`);
  if (mediaUrl) console.log(`Mídia: ${mediaUrl}`);
  console.log(`========================================`);

  // 1. Obter uma empresa (tenant) cadastrada ou criar uma dummy
  let { data: company, error: compErr } = await supabase.from('companies').select('id').limit(1).single();
  
  if (compErr || !company) {
    console.log('⚠️ Nenhuma empresa cadastrada. Criando empresa dummy "FestaControl Testes"...');
    const { data: newComp, error: newCompErr } = await supabase
      .from('companies')
      .insert({ nome: 'FestaControl Testes' })
      .select('id')
      .single();
      
    if (newCompErr) {
      console.error('Erro ao criar empresa dummy:', newCompErr);
      return;
    }
    company = newComp;
  }
  const companyId = company.id;

  // 2. Criar ou buscar uma conversa de teste
  const remetenteId = `teste_cliente_${scenarioNum}`;
  let { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('remetente_id', remetenteId)
    .single();

  if (convErr || !conv) {
    const { data: newConv, error: createConvErr } = await supabase
      .from('conversations')
      .insert({
        company_id: companyId,
        canal: 'facebook',
        remetente_id: remetenteId,
        nome_cliente: `Cliente Teste ${scenarioNum}`,
        status: 'OPEN',
        last_message: content || `[Mídia: ${type}]`
      })
      .select()
      .single();

    if (createConvErr) {
      console.error('Erro ao criar conversa:', createConvErr);
      return;
    }
    conv = newConv;
  }

  // 3. Inserir a mensagem
  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      company_id: companyId,
      conversation_id: conv.id,
      direction: 'INBOUND',
      content: content || `[Mídia: ${type}]`,
      content_type: type,
      media_url: mediaUrl,
      ai_status: type !== 'TEXT' ? 'PENDING' : 'COMPLETED'
    })
    .select()
    .single();

  if (msgErr) {
    console.error('Erro ao inserir mensagem:', msgErr);
    return;
  }

  // 4. Jogar na fila de eventos
  const { data: event, error: eventErr } = await supabase
    .from('events_queue')
    .insert({
      company_id: companyId,
      type: 'MESSAGE_RECEIVED',
      payload: {
        message_id: msg.id,
        conversation_id: conv.id,
        content: content,
        platform: 'facebook',
        media_type: type,
        media_url: mediaUrl
      },
      status: 'PENDING'
    })
    .select()
    .single();

  if (eventErr) {
    console.error('Erro ao criar evento na fila:', eventErr);
    return;
  }

  console.log(`✅ Registro de Mensagem e Conversa criados.`);
  console.log(`✅ Evento adicionado na fila (ID: ${event.id}).`);
  console.log(`⏳ Aguardando processamento... (Invocando a Edge Function)`);

  // 5. Invoca a Edge Function
  try {
    const { data: fnResult, error: fnError } = await supabase.functions.invoke('event-processor', {
      body: event
    });

    if (fnError) {
      console.error('Erro ao processar Edge Function:', fnError);
    } else {
      console.log('🎉 Resposta da Edge Function:', fnResult);
      
      // Busca a conversa atualizada para ver o crm_state
      const { data: updatedConv } = await supabase.from('conversations').select('crm_state').eq('id', conv.id).single();
      console.log('📋 Novo CRM State da Conversa:');
      console.log(JSON.stringify(updatedConv?.crm_state, null, 2));
    }
  } catch (e) {
    console.error('Falha na requisição da Edge Function:', e.message);
  }
}

async function startTests() {
  // Executa os cenários sequencialmente
  
  // Cenário 1: Texto simples
  await runScenario(1, 'TEXT', 'Oi, queria orçamento do Stitch para dia 18.');
  
  // Cenário 2: Áudio (url fictícia mas válida no formato)
  // Nota: O Gemini vai tentar baixar esse áudio. Para testar com áudio real, use uma URL pública de áudio MP4/AAC/MP3/OGG.
  // Colocamos um exemplo público para ele transcrever algo real.
  const audioUrl = 'https://www.w3schools.com/html/horse.mp3'; 
  await runScenario(2, 'AUDIO', '', audioUrl);

  // Cenário 3: Foto
  const imageUrl = 'https://picsum.photos/200/300';
  await runScenario(3, 'IMAGE', 'Queria igual essa.', imageUrl);

  // Cenário 4: Confuso
  await runScenario(4, 'TEXT', 'Oi queria aquele azul que minha prima alugou');
}

startTests();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://ksbivaolyusmrcblnnfe.supabase.co', 'sb_publishable_Rkpag_UBmc7HcqBEr7RSBw_muY6nRSJ');

async function check() {
  const { data, error } = await supabase.from('acervo').select('nome, apelidos, ativo').eq('categoria', 'Tema').eq('ativo', true);
  console.log("Error:", error);
  console.log("Data count:", data?.length);
  if (data) console.log("Data sample:", data.slice(0, 5));
}
check();

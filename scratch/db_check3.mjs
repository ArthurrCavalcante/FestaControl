import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://ksbivaolyusmrcblnnfe.supabase.co', 'sb_publishable_Rkpag_UBmc7HcqBEr7RSBw_muY6nRSJ');

async function check() {
  const { data, error } = await supabase.from('acervo').select('nome, categoria, ativo');
  console.log("Error:", error);
  console.log("Data count:", data?.length);
  if (data) {
    const cats = [...new Set(data.map(d => d.categoria))];
    console.log("Categorias:", cats);
    console.log("Ativos:", data.filter(d => d.ativo).length);
  }
}
check();

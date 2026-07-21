import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: cols1 } = await supabase.rpc('get_columns', { table_name: 'company_connections' });
  const { data: cols2 } = await supabase.rpc('get_columns', { table_name: 'provider_credentials' });
  
  if (!cols1 && !cols2) {
      // rpc might not exist, let's just query an empty row
      const { data: d1 } = await supabase.from('company_connections').select('*').limit(1);
      const { data: d2 } = await supabase.from('provider_credentials').select('*').limit(1);
      console.log('company_connections:', d1);
      console.log('provider_credentials:', d2);
  } else {
      console.log('company_connections columns:', cols1);
      console.log('provider_credentials columns:', cols2);
  }
}
check();

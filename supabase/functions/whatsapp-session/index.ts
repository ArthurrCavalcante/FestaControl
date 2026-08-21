import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/supabase-auth.ts";
import { trackError, trackFunction } from "../_shared/observability.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    return await trackFunction('Edge.WhatsAppSession', async () => {
      // Autenticar requisição (requer Bearer token do frontend)
      const { user, supabase } = await requireAuth(req);

      const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
      const globalApiKey = Deno.env.get('EVOLUTION_GLOBAL_API_KEY');
      
      if (!evolutionUrl || !globalApiKey) {
        throw new Error('Configurações da Evolution API não encontradas no servidor.');
      }

      // Descobrir o company_id do usuário logado
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      const companyId = profile?.company_id;
      if (!companyId) throw new Error('Usuário sem empresa vinculada.');

      const instanceName = companyId; // 1 instância = 1 company_id
      
      // ROTAS
      if (req.method === 'POST') {
        // Passo 1: Criar instância (se não existir)
        let response = await fetch(`${evolutionUrl}/instance/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': globalApiKey },
          body: JSON.stringify({
            instanceName,
            token: globalApiKey,
            qrcode: true,
            webhook: Deno.env.get('WEBHOOK_URL') // Opcional, ou setamos via webhook-receiver
          })
        });

        let data = await response.json();
        
        // Se a instância já existir, a Evolution pode retornar 403 ou 400. Vamos tentar buscar o QR Code direto
        if (!response.ok && data.error !== 'Instance already exists') {
          // Vamos apenas tentar conectar se já existe
        }
        
        // Passo 2: Buscar o Base64 do QR Code para retornar pro Frontend
        const qrResponse = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: { 'apikey': globalApiKey }
        });
        
        const qrData = await qrResponse.json();

        // Atualizar status no banco
        await supabase
          .from('company_settings')
          .update({ whatsapp_status: 'connecting' })
          .eq('company_id', companyId);

        return new Response(JSON.stringify({
          success: true,
          base64: qrData.base64 || qrData.qrcode?.base64,
          instance: instanceName
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (req.method === 'DELETE') {
        // Desconectar / Apagar instância
        const response = await fetch(`${evolutionUrl}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers: { 'apikey': globalApiKey }
        });
        
        await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: { 'apikey': globalApiKey }
        });

        await supabase
          .from('company_settings')
          .update({ whatsapp_status: 'disconnected' })
          .eq('company_id', companyId);

        return new Response(JSON.stringify({ success: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405, headers: corsHeaders 
      });
    }, { req });
  } catch (err: any) {
    trackError(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Trata requisições OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Valida autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { code, company_id } = await req.json()
    if (!code || !company_id) {
      return new Response(JSON.stringify({ error: 'Missing code or company_id' }), { status: 400, headers: corsHeaders })
    }

    const appSecret = Deno.env.get('META_APP_SECRET')
    const appId = '1559415199175174' // Nosso App ID

    if (!appSecret) {
      return new Response(JSON.stringify({ error: 'META_APP_SECRET not configured' }), { status: 500, headers: corsHeaders })
    }

    // 1. Troca o code pelo Access Token
    console.log("Exchanging code for token...")
    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`)
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error("Token Exchange Error:", tokenData.error)
      return new Response(JSON.stringify({ error: 'Failed to exchange token', details: tokenData.error }), { status: 400, headers: corsHeaders })
    }

    const accessToken = tokenData.access_token

    // 2. Busca o WABA ID (WhatsApp Business Account)
    console.log("Fetching WABA...")
    const wabaRes = await fetch(`https://graph.facebook.com/v19.0/me/client_whatsapp_business_accounts?access_token=${accessToken}`)
    const wabaData = await wabaRes.json()

    if (wabaData.error || !wabaData.data || wabaData.data.length === 0) {
      console.error("WABA Fetch Error:", wabaData)
      return new Response(JSON.stringify({ error: 'Failed to find WhatsApp Business Account', details: wabaData.error }), { status: 400, headers: corsHeaders })
    }

    const businessAccountId = wabaData.data[0].id

    // 3. Busca o Phone Number ID
    console.log("Fetching Phone Numbers...")
    const phoneRes = await fetch(`https://graph.facebook.com/v19.0/${businessAccountId}/phone_numbers?access_token=${accessToken}`)
    const phoneData = await phoneRes.json()

    if (phoneData.error || !phoneData.data || phoneData.data.length === 0) {
      console.error("Phone Fetch Error:", phoneData)
      return new Response(JSON.stringify({ error: 'Failed to find Phone Number', details: phoneData.error }), { status: 400, headers: corsHeaders })
    }

    const phoneNumberId = phoneData.data[0].id
    const displayPhoneNumber = phoneData.data[0].display_phone_number

    // 4. Insere no Supabase (company_connections e provider_credentials)
    // Primeiro, checa se a conexão já existe ou cria uma nova
    let connectionId;
    const { data: existingConn } = await supabase
      .from('company_connections')
      .select('id')
      .eq('company_id', company_id)
      .eq('provider', 'whatsapp')
      .single()

    if (existingConn) {
      connectionId = existingConn.id
      await supabase.from('company_connections').update({ status: 'ACTIVE' }).eq('id', connectionId)
    } else {
      const { data: newConn, error: connError } = await supabase
        .from('company_connections')
        .insert({
          company_id: company_id,
          provider: 'whatsapp',
          display_name: `WhatsApp Oficial (${displayPhoneNumber})`,
          status: 'ACTIVE'
        }).select().single()
      
      if (connError) throw connError
      connectionId = newConn.id
    }

    // Deleta credenciais antigas se houver
    await supabase.from('provider_credentials').delete().eq('connection_id', connectionId)

    // Insere as novas
    const { error: credsError } = await supabase
      .from('provider_credentials')
      .insert({
        connection_id: connectionId,
        encrypted_access_token: accessToken, // Em produção, deveria ser criptografado, mas vamos salvar como texto por enquanto
        phone_number_id: phoneNumberId,
        business_account_id: businessAccountId,
        token_type: tokenData.token_type || 'bearer'
      })

    if (credsError) throw credsError

    // Retorna sucesso
    return new Response(JSON.stringify({ 
      success: true, 
      phone_number_id: phoneNumberId,
      business_account_id: businessAccountId,
      display_phone_number: displayPhoneNumber
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Edge Function Error:", error)
    return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

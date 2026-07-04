import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64, temasCadastrados } = await req.json()
    
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'Nenhuma imagem fornecida.' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Validação de Autenticação JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Erro de Autenticação JWT:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401, headers: corsHeaders })
    }

    // A chave do Gemini agora vive de forma segura no backend (gerenciada pelos secrets do Supabase)
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Chave do Gemini não configurada no servidor.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const listaTemasText = temasCadastrados 
      ? JSON.stringify(temasCadastrados)
      : '[]';

    const prompt = `Você é um assistente especializado em identificar temas de festas infantis a partir de fotos.
    Abaixo está a lista JSON estrita de temas físicos disponíveis no acervo da loja, contendo o nome oficial e apelidos comuns:
    ${listaTemasText}
    
    TAREFA:
    1. Analise a foto fornecida.
    2. Escolha APENAS UM dos temas da lista acima que corresponda visualmente à foto.
    3. Considere a lista de apelidos para fazer a ponte de correspondência, MAS retorne SEMPRE o "nome" oficial do tema conforme escrito na lista.
    4. NUNCA invente um nome. Se não encontrar nenhuma correspondência forte na lista, responda "Desconhecido".
    5. Identifique cores principais e itens da decoração presentes.
    
    Retorne um JSON estrito com:
    {
      "tema": "nome do tema identificado (Exato como na lista) ou Desconhecido",
      "cores": ["cor principal 1", "cor 2"],
      "itens": ["mesa rustica", "arco desconstruido", "cilindro"]
    }
    Não retorne nada além do JSON.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const responseText = result.response.text();
    let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    let jsonResult = jsonMatch ? jsonMatch[1] : responseText;
    
    const parsedData = JSON.parse(jsonResult);

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return new Response(JSON.stringify({ error: 'Erro ao analisar imagem.', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

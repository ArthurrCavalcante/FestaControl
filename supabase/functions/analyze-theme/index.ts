import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
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
    const { imageBase64, imagesBase64, temasCadastrados } = await req.json()
    
    // Suporte para o novo formato em lote ou o formato antigo
    const imagesToProcess = imagesBase64 ? imagesBase64 : (imageBase64 ? [imageBase64] : []);

    if (imagesToProcess.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma imagem fornecida.' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Validação de Autenticação JWT bypassada
    // const authHeader = req.headers.get('Authorization')
    // if (!authHeader) {
    //   return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    // }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // const token = authHeader.replace('Bearer ', '')
    // const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    // if (authError || !user) {
    //   console.error('Erro de Autenticação JWT:', authError)
    //   return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401, headers: corsHeaders })
    // }

    // A chave do Gemini agora vive de forma segura no backend (gerenciada pelos secrets do Supabase)
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Chave do Gemini não configurada no servidor.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const listaTemasText = temasCadastrados 
      ? JSON.stringify(temasCadastrados)
      : '[]';

    const prompt = `Você é um assistente especializado em identificar temas de festas infantis a partir de fotos.
    Abaixo está a lista JSON estrita de temas físicos disponíveis no acervo da loja, contendo o nome oficial e apelidos comuns:
    ${listaTemasText}
    
    TAREFA:
    Eu estou enviando ${imagesToProcess.length} foto(s) na ordem.
    Para CADA foto, você deve:
    1. Identificar o tema da festa infantil ou evento.
    2. SE o tema identificado existir na lista fornecida (mesmo que por apelido), retorne o NOME OFICIAL que está na lista.
    3. SE o tema NÃO estiver na lista, você tem liberdade para escrever o nome do tema que você deduziu (ex: "Safari", "Homem-Aranha", "Casamento", "Chá de Bebê").
    4. Identificar as cores principais e os itens de decoração presentes.
    
    Você deve obrigatoriamente retornar APENAS um ARRAY JSON ESTRITO contendo um objeto para CADA foto, na mesma ordem em que foram enviadas.
    Exemplo de formato esperado:
    [
      {
        "tema": "Safari",
        "cores": ["Verde", "Marrom"],
        "itens": ["mesa rustica", "arco desconstruido", "cilindro", "folhagens"]
      }
    ]
    Não escreva nenhum texto fora do array JSON.`;

    const inlineDataParts = imagesToProcess.map(base64 => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64
      }
    }));

    // Chamada direta à API REST do Gemini (sem SDK) para máxima compatibilidade
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            ...inlineDataParts
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error(`Gemini API error ${geminiResponse.status}:`, errText);
      
      return new Response(JSON.stringify({ 
        error: 'Erro na API do Gemini.', 
        details: `HTTP ${geminiResponse.status}`,
        raw: errText.substring(0, 500)
      }), {
        status: geminiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiResult = await geminiResponse.json();
    
    // Extrai o texto da resposta do Gemini
    const responseText = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Tenta múltiplos padrões de extração de JSON
    let parsedData;
    try {
      let jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[1]);
      } else {
        jsonMatch = responseText.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[1]);
        } else {
          // Tenta extrair o primeiro array JSON da resposta
          const jsonArrMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonArrMatch) {
            parsedData = JSON.parse(jsonArrMatch[0]);
          } else {
            parsedData = JSON.parse(responseText.trim());
          }
        }
      }
      
      // Garante que retorne sempre um array para manter compatibilidade com o formato de lote
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }

      // Injeta o raw string para debug
      if (parsedData.length > 0) {
        parsedData[0]._debug_raw = responseText;
        parsedData[0]._debug_images_len = imagesToProcess.length;
      }
    } catch (parseError) {
      console.error("Falha ao parsear JSON da IA:", responseText);
      parsedData = imagesToProcess.map(() => ({ tema: "Desconhecido", cores: [], itens: [] }));
    }

    return new Response(JSON.stringify(imagesBase64 ? parsedData : parsedData[0]), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return new Response(JSON.stringify({ error: 'Erro ao analisar imagem.', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

export async function analyzeConversation(previousState: any, chatTranscript: string, mediaPayload?: { base64: string, mimeType: string }) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada');

  const prompt = `Você é um assistente inteligente de CRM de locação de festas infantis.
Sua função é atualizar a "Ficha Viva" (CRM State) de um cliente com base em uma nova interação, combinando com o estado anterior.

### ESTADO ANTERIOR:
${JSON.stringify(previousState, null, 2)}

### NOVA INTERAÇÃO (ou histórico de chat):
${chatTranscript}

### INSTRUÇÕES:
1. Analise a Nova Interação. Se houver mídia de áudio/imagem, considere-a.
2. Atualize os campos do Estado Anterior com os novos dados identificados. 
3. Não apague dados anteriores a menos que o cliente mude explicitamente de ideia (ex: mudar o tema).
4. O campo "intencao" pode ser: CURIOUS, PRICE, PURCHASE, COMPLAINT, CANCELED.
5. Se detectar uma objeção (ex: "está caro", "vou falar com marido", "não sei a data"), preencha o campo "objecao" com:
   { "type": "price|time|decision|availability|other", "message": "o que o cliente disse" }
6. Mantenha o JSON na estrutura base fornecida.

7. Se houver áudio ou imagem, forneça a transcrição/descrição no campo "transcricao" na raiz do JSON.

Responda APENAS um objeto JSON válido, sem markdown:
{
  "transcricao": "...",
  "cliente": { "nome": "...", "telefone": "...", "bairro": "..." },
  "evento": { "tema": "...", "data": "...", "horario": "..." },
  "orcamento": { "valor_desejado": 900 },
  "sentimento": "interessado",
  "intencao": "PURCHASE",
  "objecao": { "type": "...", "message": "..." } ou null,
  "proxima_acao": "sugestão do que o vendedor deve fazer agora",
  "missing_fields": ["campos importantes vazios"],
  "confidence": 95
}`;

  const parts = [{ text: prompt }];

  if (mediaPayload) {
    parts.push({
      inlineData: {
        mimeType: mediaPayload.mimeType,
        data: mediaPayload.base64
      }
    } as any);
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
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

-- ========================================================
-- MIGRATION: CRM State na tabela Conversations
-- ========================================================

-- Adiciona a coluna crm_state que vai atuar como a "Ficha Viva" da conversa
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS crm_state JSONB DEFAULT '{
  "cliente": { "nome": null, "telefone": null, "bairro": null },
  "evento": { "tema": null, "data": null, "horario": null },
  "orcamento": { "valor_desejado": null },
  "sentimento": null,
  "intencao": null,
  "objecao": null,
  "proxima_acao": null,
  "missing_fields": [],
  "confidence": 0
}'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN public.conversations.crm_state IS 'Estado atual do CRM extraído via IA baseado na evolução da conversa';

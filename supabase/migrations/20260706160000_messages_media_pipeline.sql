-- ========================================================
-- MIGRATION: Media Pipeline para a tabela Messages
-- ========================================================

-- Atualizando a tabela messages para suportar metadados da IA e mídias
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'TEXT', -- TEXT, AUDIO, IMAGE, DOCUMENT
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'COMPLETED', -- PENDING, PROCESSING, COMPLETED, ERROR
ADD COLUMN IF NOT EXISTS ai_confidence INT,
ADD COLUMN IF NOT EXISTS intent TEXT;

-- Comentários da tabela para documentar o esquema
COMMENT ON COLUMN public.messages.content_type IS 'O tipo do conteúdo original recebido ou enviado';
COMMENT ON COLUMN public.messages.ai_status IS 'Status do processamento da IA sobre esta mensagem';

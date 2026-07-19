-- ========================================================
-- MIGRATION: Add Evolution API constraints and status
-- ========================================================

-- 1. Deduplicar conversas existentes (mantém a mais recente)
DELETE FROM public.conversations
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, canal, remetente_id ORDER BY last_activity DESC) as rn
    FROM public.conversations
  ) t
  WHERE t.rn > 1
);

-- 2. Deduplicar mensagens existentes (mantém a mais recente)
DELETE FROM public.messages
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY provider_message_id ORDER BY created_at DESC) as rn
    FROM public.messages
    WHERE provider_message_id IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- 3. Constraints
ALTER TABLE public.conversations ADD CONSTRAINT uq_company_canal_remetente UNIQUE (company_id, canal, remetente_id);
ALTER TABLE public.messages ADD CONSTRAINT uq_provider_message UNIQUE (provider_message_id);

-- 4. WhatsApp connection status on company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT 'disconnected';

-- ========================================================
-- MIGRATION: Enterprise Architecture Refactoring
-- ========================================================

-- 1. Refatoração de company_connections
-- A coluna platform foi mantida para compatibilidade, mas renomeada simbolicamente nas views futuras.
-- Adicionando a coluna metadata JSONB para armazenar tokens criptografados e secrets
ALTER TABLE public.company_connections ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.company_connections ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.company_connections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Copiar os dados existentes da coluna platform para provider
UPDATE public.company_connections SET provider = platform WHERE provider IS NULL;

-- 2. Atualizações na tabela de conversas
-- Novos estados estilo Zendesk (NEW, ACTIVE, WAITING_CLIENT, WAITING_COMPANY, LEAD_CREATED, ARCHIVED)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS human_takeover BOOLEAN DEFAULT false;

-- Mudar o default de status para 'NEW' (mantendo compatibilidade com registros antigos)
ALTER TABLE public.conversations ALTER COLUMN status SET DEFAULT 'NEW';

-- 3. Atualizações na tabela de mensagens
-- Quem enviou a mensagem (USER = cliente, BOT = IA, HUMAN = Atendente, SYSTEM = Alertas)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_type TEXT DEFAULT 'USER';

-- Atualizar mensagens existentes baseadas na direção
UPDATE public.messages SET sender_type = 'USER' WHERE direction = 'INBOUND';
UPDATE public.messages SET sender_type = 'HUMAN' WHERE direction = 'OUTBOUND';

-- 4. Notificações do Event Bus
-- Podemos querer registrar todos os eventos em uma nova tabela de log ou estender events_queue
-- events_queue já serve perfeitamente como nosso Event Bus.

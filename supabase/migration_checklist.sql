-- =====================================================
-- MIGRATION: Adicionar coluna checklist (JSONB) na tabela events
-- Rode este script no SQL Editor do Supabase Dashboard
-- =====================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '{}'::jsonb;

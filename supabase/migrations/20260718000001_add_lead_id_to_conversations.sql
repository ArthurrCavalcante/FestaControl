-- Adiciona coluna lead_id na tabela conversations para o fluxo de Transformar em Lead
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

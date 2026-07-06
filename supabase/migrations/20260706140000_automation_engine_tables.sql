-- ========================================================
-- MIGRATION: The Automation Engine (Event-Driven Architecture)
-- ========================================================

-- 1. Tabela de Conexões (Mapeamento Webhook -> Empresa)
CREATE TABLE IF NOT EXISTS public.company_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- ex: 'facebook', 'whatsapp'
    external_id TEXT NOT NULL, -- ex: O ID da página no FB ou número no WPP
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, external_id)
);

ALTER TABLE public.company_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant company_connections" ON public.company_connections
  FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));


-- 2. Tabela de Fila de Eventos (Dumb Webhook -> Events Queue)
CREATE TABLE IF NOT EXISTS public.events_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- ex: 'MESSAGE_RECEIVED'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.events_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant events_queue" ON public.events_queue
  FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

-- Trigger para definir company_id automaticamente no insert
CREATE TRIGGER set_events_queue_company_id
  BEFORE INSERT ON public.events_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id();


-- 3. Tabela de Histórico de Execuções (Auditoria)
CREATE TABLE IF NOT EXISTS public.automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events_queue(id) ON DELETE SET NULL,
    automation_name TEXT NOT NULL, -- ex: 'Criar Lead', 'AI Extraction'
    status TEXT NOT NULL, -- SUCCESS, ERROR
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant automation_runs" ON public.automation_runs
  FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

-- Trigger para definir company_id automaticamente no insert
CREATE TRIGGER set_automation_runs_company_id
  BEFORE INSERT ON public.automation_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id();

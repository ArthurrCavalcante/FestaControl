-- ========================================================
-- MIGRATION: Inbox Tasks (Caixa de Entrada Universal)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.inbox_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- ex: 'AI_REVIEW', 'PAYMENT', 'CONFLICT'
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, RESOLVED, IGNORED
    priority TEXT NOT NULL DEFAULT 'NORMAL', -- HIGH, NORMAL, LOW
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.inbox_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant inbox_tasks" ON public.inbox_tasks
  FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

-- Trigger para definir company_id automaticamente no insert
CREATE TRIGGER set_inbox_tasks_company_id
  BEFORE INSERT ON public.inbox_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id();

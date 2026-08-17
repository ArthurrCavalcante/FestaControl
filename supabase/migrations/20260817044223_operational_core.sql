-- FestaFlow — núcleo operacional: reservas, financeiro e tarefas de evento.

-- 1. Estoque físico do acervo.
ALTER TABLE public.acervo
  ADD COLUMN IF NOT EXISTS quantidade_total integer NOT NULL DEFAULT 1;

ALTER TABLE public.acervo
  DROP CONSTRAINT IF EXISTS acervo_quantidade_total_positiva;
ALTER TABLE public.acervo
  ADD CONSTRAINT acervo_quantidade_total_positiva CHECK (quantidade_total > 0);

-- 2. Reserva de peças por período de evento.
CREATE TABLE IF NOT EXISTS public.acervo_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  acervo_id uuid NOT NULL REFERENCES public.acervo(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  status text NOT NULL DEFAULT 'RESERVADO'
    CHECK (status IN ('RESERVADO', 'SEPARADO', 'ENTREGUE', 'DEVOLVIDO', 'CANCELADO', 'MANUTENCAO')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_acervo_reservas_evento ON public.acervo_reservas(event_id);
CREATE INDEX IF NOT EXISTS idx_acervo_reservas_item_periodo ON public.acervo_reservas(acervo_id, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_acervo_reservas_company ON public.acervo_reservas(company_id);

-- 3. Controle de propostas e pagamentos.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS proposta_status text NOT NULL DEFAULT 'RASCUNHO'
    CHECK (proposta_status IN ('RASCUNHO', 'ENVIADA', 'APROVADA', 'RECUSADA', 'VENCIDA', 'CANCELADA')),
  ADD COLUMN IF NOT EXISTS proposta_validade date,
  ADD COLUMN IF NOT EXISTS proposta_aceita_em timestamptz,
  ADD COLUMN IF NOT EXISTS custo_estimado numeric(12, 2) NOT NULL DEFAULT 0 CHECK (custo_estimado >= 0);

CREATE TABLE IF NOT EXISTS public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT 'Pagamento',
  tipo text NOT NULL DEFAULT 'PARCELA' CHECK (tipo IN ('SINAL', 'PARCELA', 'AJUSTE', 'REEMBOLSO')),
  valor numeric(12, 2) NOT NULL CHECK (valor > 0),
  vencimento date,
  pago_em timestamptz,
  status text NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO')),
  metodo text,
  comprovante_url text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_deal ON public.pagamentos(deal_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_evento ON public.pagamentos(event_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_company_status ON public.pagamentos(company_id, status, vencimento);

-- 4. Execução de operação e responsabilidades por evento.
CREATE TABLE IF NOT EXISTS public.event_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  etapa text NOT NULL DEFAULT 'SEPARACAO'
    CHECK (etapa IN ('SEPARACAO', 'ENTREGA', 'MONTAGEM', 'DESMONTAGEM', 'RETIRADA', 'FINANCEIRO')),
  responsavel text,
  prazo timestamptz,
  status text NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  concluida_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_event_tasks_evento_status ON public.event_tasks(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_tasks_company_prazo ON public.event_tasks(company_id, prazo);

-- 5. Isolamento multiempresa e preenchimento automático da empresa.
ALTER TABLE public.acervo_reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Isolate tenant acervo_reservas" ON public.acervo_reservas;
DROP POLICY IF EXISTS "Isolate tenant pagamentos" ON public.pagamentos;
DROP POLICY IF EXISTS "Isolate tenant event_tasks" ON public.event_tasks;

CREATE POLICY "Isolate tenant acervo_reservas" ON public.acervo_reservas
  FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));
CREATE POLICY "Isolate tenant pagamentos" ON public.pagamentos
  FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));
CREATE POLICY "Isolate tenant event_tasks" ON public.event_tasks
  FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

DROP TRIGGER IF EXISTS set_acervo_reservas_company_id ON public.acervo_reservas;
CREATE TRIGGER set_acervo_reservas_company_id
  BEFORE INSERT ON public.acervo_reservas FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
DROP TRIGGER IF EXISTS set_pagamentos_company_id ON public.pagamentos;
CREATE TRIGGER set_pagamentos_company_id
  BEFORE INSERT ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
DROP TRIGGER IF EXISTS set_event_tasks_company_id ON public.event_tasks;
CREATE TRIGGER set_event_tasks_company_id
  BEFORE INSERT ON public.event_tasks FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

-- 6. Consulta de disponibilidade para a data escolhida no orçamento.
CREATE OR REPLACE FUNCTION public.get_acervo_disponibilidade(p_data date)
RETURNS TABLE (acervo_id uuid, quantidade_total integer, quantidade_reservada bigint, quantidade_disponivel bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT
    a.id,
    a.quantidade_total,
    COALESCE(SUM(r.quantidade) FILTER (
      WHERE r.status IN ('RESERVADO', 'SEPARADO', 'ENTREGUE')
        AND r.data_inicio <= p_data
        AND r.data_fim >= p_data
    ), 0)::bigint AS quantidade_reservada,
    (a.quantidade_total - COALESCE(SUM(r.quantidade) FILTER (
      WHERE r.status IN ('RESERVADO', 'SEPARADO', 'ENTREGUE')
        AND r.data_inicio <= p_data
        AND r.data_fim >= p_data
    ), 0))::bigint AS quantidade_disponivel
  FROM public.acervo a
  LEFT JOIN public.acervo_reservas r ON r.acervo_id = a.id
  WHERE a.ativo = true AND a.deleted_at IS NULL
  GROUP BY a.id, a.quantidade_total;
$$;

REVOKE EXECUTE ON FUNCTION public.get_acervo_disponibilidade(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_acervo_disponibilidade(date) TO authenticated;

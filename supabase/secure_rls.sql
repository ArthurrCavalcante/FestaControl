-- =====================================================
-- SEGURANÇA: Habilitar RLS e restringir a usuários autenticados
-- Rode este script no SQL Editor do Supabase Dashboard
-- =====================================================

-- 1. Habilitar RLS em todas as tabelas (se já estiver habilitado, não faz nada)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa_entrada ENABLE ROW LEVEL SECURITY;

-- 2. Dropar policies antigas que possam existir (nomes comuns)
--    Se não existirem, o DROP POLICY IF EXISTS não faz nada
DROP POLICY IF EXISTS "Permitir tudo" ON public.leads;
DROP POLICY IF EXISTS "Permitir tudo" ON public.deals;
DROP POLICY IF EXISTS "Permitir tudo" ON public.events;
DROP POLICY IF EXISTS "Permitir tudo" ON public.catalogo_fotos;
DROP POLICY IF EXISTS "Permitir tudo" ON public.caixa_entrada;
DROP POLICY IF EXISTS "Enable access for all users" ON public.leads;
DROP POLICY IF EXISTS "Enable access for all users" ON public.deals;
DROP POLICY IF EXISTS "Enable access for all users" ON public.events;
DROP POLICY IF EXISTS "Enable access for all users" ON public.catalogo_fotos;
DROP POLICY IF EXISTS "Enable access for all users" ON public.caixa_entrada;

-- 3. Criar policies novas: somente role 'authenticated' tem acesso
CREATE POLICY "Authenticated full access" ON public.leads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON public.deals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON public.events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON public.catalogo_fotos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON public.caixa_entrada
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

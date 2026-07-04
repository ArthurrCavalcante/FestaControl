-- =====================================================
-- MIGRATION: Multi-Tenant Architecture (Company Data Isolation)
-- Rode este script no SQL Editor do Supabase Dashboard
-- =====================================================

-- 1. Create PROFILES table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    foto TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- Garantir que as colunas existem caso a tabela já existisse
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT 'Usuário';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Garantir que o ID tenha um valor padrão (caso a tabela tenha sido criada manualmente sem ele)
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Garantir que a constraint unique existe para o ON CONFLICT funcionar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- Habilitar RLS em profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuário vê apenas o próprio perfil" ON public.profiles;
CREATE POLICY "Usuário vê apenas o próprio perfil" ON public.profiles
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Migrar dados de user_roles para profiles
INSERT INTO public.profiles (id, user_id, company_id, role, nome)
SELECT user_id, user_id, company_id, role, 'Administrador' FROM public.user_roles
ON CONFLICT (id) DO NOTHING;

-- 2. Adicionar company_id nas tabelas
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.catalogo_fotos ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.caixa_entrada ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.acervo ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. Função para injetar company_id automaticamente em novos inserts
CREATE OR REPLACE FUNCTION public.set_company_id()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Obter o company_id do usuário logado
  SELECT company_id INTO v_company_id 
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF v_company_id IS NOT NULL THEN
    NEW.company_id := v_company_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar Triggers para todas as tabelas
DROP TRIGGER IF EXISTS set_leads_company_id ON public.leads;
CREATE TRIGGER set_leads_company_id BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_deals_company_id ON public.deals;
CREATE TRIGGER set_deals_company_id BEFORE INSERT ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_events_company_id ON public.events;
CREATE TRIGGER set_events_company_id BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_catalogo_fotos_company_id ON public.catalogo_fotos;
CREATE TRIGGER set_catalogo_fotos_company_id BEFORE INSERT ON public.catalogo_fotos FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_caixa_entrada_company_id ON public.caixa_entrada;
CREATE TRIGGER set_caixa_entrada_company_id BEFORE INSERT ON public.caixa_entrada FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_acervo_company_id ON public.acervo;
CREATE TRIGGER set_acervo_company_id BEFORE INSERT ON public.acervo FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

-- 4. Migração automática dos dados existentes
DO $$
DECLARE
  v_main_company_id UUID;
  v_demo_company_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Buscar a empresa principal (que não seja a Demo)
  SELECT id INTO v_main_company_id FROM public.companies WHERE id != v_demo_company_id LIMIT 1;
  
  -- Se não existir empresa principal, vamos criar uma
  IF v_main_company_id IS NULL THEN
     v_main_company_id := gen_random_uuid();
     INSERT INTO public.companies (id, nome) VALUES (v_main_company_id, 'Minha Empresa FestaFlow');
     INSERT INTO public.company_settings (company_id, primary_color) VALUES (v_main_company_id, '#6366f1');
  END IF;

  -- Vincular usuários reais à empresa principal (e criar seus profiles se faltar)
  INSERT INTO public.profiles (id, user_id, company_id, nome, role)
  SELECT id, id, v_main_company_id, 'Administrador Principal', 'admin' 
  FROM auth.users 
  WHERE email != 'visitante@festaflow.com'
  ON CONFLICT (id) DO UPDATE SET company_id = v_main_company_id;

  -- Atualizar todos os dados "órfãos" para a empresa principal
  UPDATE public.leads SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.deals SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.events SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.catalogo_fotos SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.caixa_entrada SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.acervo SET company_id = v_main_company_id WHERE company_id IS NULL;
END $$;

-- 5. Função de segurança para as policies RLS (is_same_company)
CREATE OR REPLACE FUNCTION public.is_same_company(row_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_company_id UUID;
BEGIN
  SELECT company_id INTO user_company_id FROM public.profiles WHERE user_id = auth.uid();
  RETURN row_company_id = user_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Aplicar Policies RLS isoladas (Multi-tenant)
-- Primeiro, apagamos todas as políticas antigas para garantir que nenhuma "USING (true)" vaze dados
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('leads', 'deals', 'events', 'catalogo_fotos', 'caixa_entrada', 'acervo', 'companies', 'company_settings')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

CREATE POLICY "Isolate tenant leads" ON public.leads FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

CREATE POLICY "Isolate tenant deals" ON public.deals FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

CREATE POLICY "Isolate tenant events" ON public.events FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

CREATE POLICY "Isolate tenant catalogo_fotos" ON public.catalogo_fotos FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

CREATE POLICY "Isolate tenant caixa_entrada" ON public.caixa_entrada FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

-- Acervo precisa de RLS
ALTER TABLE public.acervo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant acervo" ON public.acervo FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

-- Compartilhar configurações e empresa
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant companies" ON public.companies FOR ALL TO authenticated USING (is_same_company(id)) WITH CHECK (is_same_company(id));

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant company_settings" ON public.company_settings FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

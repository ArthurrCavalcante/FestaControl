-- =====================================================
-- MIGRATION: Multi-Tenant Architecture & Onboarding Fixes
-- Consolida isolation, onboarding robusto e fix de user_id
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
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Preencher user_ids faltantes de perfis antigos
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

-- Garantir unique
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- Habilitar RLS em profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Limpar TODAS as políticas duplicadas legadas do profiles (Ponto 5)
DROP POLICY IF EXISTS "Usuário vê apenas o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuário edita o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "User Profile Update" ON public.profiles;
DROP POLICY IF EXISTS "User Profile Select" ON public.profiles;
DROP POLICY IF EXISTS "User Profile Insert" ON public.profiles;

CREATE POLICY "Usuário vê apenas o próprio perfil" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Usuário edita o próprio perfil" ON public.profiles FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Migrar dados de user_roles para profiles
INSERT INTO public.profiles (id, user_id, company_id, role, nome)
SELECT user_id, user_id, company_id, role, 'Administrador' FROM public.user_roles
ON CONFLICT (id) DO NOTHING;

-- 2. Adicionar company_id nas tabelas e Triggers
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.catalogo_fotos ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.caixa_entrada ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.acervo ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.kits ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.acervo_composicao ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.set_company_id() RETURNS TRIGGER AS $$
DECLARE v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id FROM public.profiles WHERE user_id = auth.uid();
  IF v_company_id IS NOT NULL THEN NEW.company_id := v_company_id; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ 
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['leads','deals','events','catalogo_fotos','caixa_entrada','acervo','kits','activity_logs','error_logs','user_roles','acervo_composicao','conversations','messages']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_company_id ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER set_%I_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_company_id()', t, t);
  END LOOP;
END $$;

-- 4. Migração automática dos dados existentes
DO $$
DECLARE
  v_main_company_id UUID;
  v_demo_company_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO v_main_company_id FROM public.companies WHERE id != v_demo_company_id LIMIT 1;
  IF v_main_company_id IS NULL THEN
     v_main_company_id := gen_random_uuid();
     INSERT INTO public.companies (id, nome) VALUES (v_main_company_id, 'Minha Empresa FestaFlow');
     INSERT INTO public.company_settings (company_id, primary_color) VALUES (v_main_company_id, '#6366f1');
  END IF;

  INSERT INTO public.profiles (id, user_id, company_id, nome, role)
  SELECT id, id, v_main_company_id, 'Administrador Principal', 'admin' 
  FROM auth.users WHERE email != 'visitante@festaflow.com'
  ON CONFLICT (id) DO UPDATE SET company_id = v_main_company_id;

  UPDATE public.leads SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.deals SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.events SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.catalogo_fotos SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.caixa_entrada SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.acervo SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.kits SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.activity_logs SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.error_logs SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.user_roles SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.acervo_composicao SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.conversations SET company_id = v_main_company_id WHERE company_id IS NULL;
  UPDATE public.messages SET company_id = v_main_company_id WHERE company_id IS NULL;
END $$;

-- 5. Função de segurança para as policies RLS (is_same_company)
CREATE OR REPLACE FUNCTION public.is_same_company(row_company_id UUID) RETURNS BOOLEAN AS $$
DECLARE user_company_id UUID;
BEGIN
  SELECT company_id INTO user_company_id FROM public.profiles WHERE user_id = auth.uid();
  RETURN row_company_id = user_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Aplicar Policies RLS isoladas (Multi-tenant)
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' 
        AND tablename IN ('leads', 'deals', 'events', 'catalogo_fotos', 'caixa_entrada', 'acervo', 'companies', 'company_settings', 'kits', 'activity_logs', 'error_logs', 'user_roles', 'acervo_composicao', 'conversations', 'messages')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

CREATE POLICY "Isolate tenant leads" ON public.leads FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));
CREATE POLICY "Isolate tenant deals" ON public.deals FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));
CREATE POLICY "Isolate tenant events" ON public.events FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));
CREATE POLICY "Isolate tenant catalogo_fotos" ON public.catalogo_fotos FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));
CREATE POLICY "Isolate tenant caixa_entrada" ON public.caixa_entrada FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));
ALTER TABLE public.acervo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant acervo" ON public.acervo FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant companies" ON public.companies FOR ALL TO authenticated USING (is_same_company(id)) WITH CHECK (is_same_company(id));
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant company_settings" ON public.company_settings FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

-- Isolar tabelas adicionais e apagar permissões públicas abertas antigas
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant kits" ON public.kits FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant activity_logs" ON public.activity_logs FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant error_logs" ON public.error_logs FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant user_roles" ON public.user_roles FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

ALTER TABLE public.acervo_composicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant acervo_composicao" ON public.acervo_composicao FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant conversations" ON public.conversations FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolate tenant messages" ON public.messages FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));



-- 7. Função de Onboarding
CREATE OR REPLACE FUNCTION public.create_new_tenant(p_company_name text, p_user_name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autorizado.'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND company_id IS NOT NULL) THEN RETURN; END IF;
  
  INSERT INTO public.companies (nome) VALUES (p_company_name) RETURNING id INTO v_company_id;
  INSERT INTO public.company_settings (company_id, primary_color) VALUES (v_company_id, '#f97316');
  
  INSERT INTO public.profiles (id, user_id, nome, role, company_id)
  VALUES (v_user_id, v_user_id, p_user_name, 'admin', v_company_id)
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, nome = EXCLUDED.nome, company_id = EXCLUDED.company_id, role = 'admin';
END;
$$;

-- 8. Restringir acesso de execução ao onboarding
REVOKE EXECUTE ON FUNCTION public.create_new_tenant(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_new_tenant(text, text) TO authenticated;

-- 9. Políticas de Segurança RLS para o Storage (Bucket: Catalogo)
-- Garante que apenas usuários logados (authenticated) possam subir ou deletar arquivos
CREATE POLICY "Permitir leitura pública do catálogo" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'Catalogo');

CREATE POLICY "Permitir upload apenas para autenticados" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'Catalogo');

CREATE POLICY "Permitir exclusão apenas para autenticados" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'Catalogo');


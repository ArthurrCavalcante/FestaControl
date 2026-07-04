-- Função para criar uma nova empresa (tenant) de forma segura durante o Onboarding
-- Deve ser executada no SQL Editor do Supabase

CREATE OR REPLACE FUNCTION public.create_new_tenant(
  p_company_name text,
  p_user_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
BEGIN
  -- 1. Capturar o usuário autenticado de forma segura
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado. Usuário deve estar autenticado.';
  END IF;

  -- 2. Trava contra Onboarding Duplo
  -- Se o usuário já tem um profile e já tem company_id, não permitir criar outra.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_user_id AND company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Usuário já possui empresa vinculada.';
  END IF;

  -- 3. Criar a nova empresa
  INSERT INTO public.companies (nome)
  VALUES (p_company_name)
  RETURNING id INTO v_company_id;

  -- 4. Criar ou Atualizar o perfil do usuário
  -- Como o trigger on_auth_user_created talvez não exista ou tenha falhado, fazemos um UPSERT
  INSERT INTO public.profiles (user_id, nome, role, company_id)
  VALUES (v_user_id, p_user_name, 'admin', v_company_id)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    nome = EXCLUDED.nome,
    role = 'admin',
    company_id = EXCLUDED.company_id;

  -- 5. Criar configurações padrão para a empresa recém-criada
  INSERT INTO public.company_settings (company_id, primary_color)
  VALUES (v_company_id, '#f97316'); -- Laranja padrão

END;
$$;

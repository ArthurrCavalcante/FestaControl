-- Tenant marker used to prevent side effects from the public demo account.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

UPDATE public.companies
SET is_demo = true
WHERE id = '00000000-0000-0000-0000-000000000001'
   OR id IN (
     SELECT p.company_id
     FROM public.profiles p
     JOIN auth.users u ON u.id = p.user_id
     WHERE u.email = 'visitante@festaflow.com'
   );

-- Replace every legacy object policy with the two documented bucket contracts.
DO $policy_cleanup$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
  END LOOP;
END
$policy_cleanup$;

CREATE POLICY "Catalogo public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'Catalogo');

CREATE POLICY "Catalogo tenant insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'Catalogo'
  AND (storage.foldername(name))[1] = (
    SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Catalogo tenant update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'Catalogo'
  AND (storage.foldername(name))[1] = (
    SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'Catalogo'
  AND (storage.foldername(name))[1] = (
    SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Catalogo tenant delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'Catalogo'
  AND (storage.foldername(name))[1] = (
    SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "CRM tenant select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'crm'
  AND (storage.foldername(name))[1] = 'companies'
  AND (storage.foldername(name))[2] = (
    SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
  AND (storage.foldername(name))[3] = 'deals'
  AND EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id::text = (storage.foldername(name))[4]
      AND d.company_id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "CRM tenant insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'crm'
  AND (storage.foldername(name))[1] = 'companies'
  AND (storage.foldername(name))[2] = (
    SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
  AND (storage.foldername(name))[3] = 'deals'
  AND EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id::text = (storage.foldername(name))[4]
      AND d.company_id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "CRM tenant update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'crm'
  AND (storage.foldername(name))[1] = 'companies'
  AND (storage.foldername(name))[2] = (
    SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
  AND (storage.foldername(name))[3] = 'deals'
)
WITH CHECK (
  bucket_id = 'crm'
  AND (storage.foldername(name))[1] = 'companies'
  AND (storage.foldername(name))[2] = (
    SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
  AND (storage.foldername(name))[3] = 'deals'
  AND EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id::text = (storage.foldername(name))[4]
      AND d.company_id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "CRM tenant delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'crm'
  AND (storage.foldername(name))[1] = 'companies'
  AND (storage.foldername(name))[2] = (
    SELECT p.company_id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
  AND (storage.foldername(name))[3] = 'deals'
);

-- Credentials may be inspected only through non-secret columns by their tenant.
UPDATE public.provider_credentials SET encrypted_access_token = NULL
WHERE encrypted_access_token IS NOT NULL;

DO $credential_policy_cleanup$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'provider_credentials'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.provider_credentials', policy_record.policyname);
  END LOOP;
END
$credential_policy_cleanup$;

CREATE POLICY "Tenant credential read"
ON public.provider_credentials FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.company_connections connection
  WHERE connection.id = provider_credentials.connection_id
    AND public.is_same_company(connection.company_id)
));

CREATE POLICY "Tenant credential insert"
ON public.provider_credentials FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.company_connections connection
  WHERE connection.id = provider_credentials.connection_id
    AND public.is_same_company(connection.company_id)
));

CREATE POLICY "Tenant credential update"
ON public.provider_credentials FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.company_connections connection
  WHERE connection.id = provider_credentials.connection_id
    AND public.is_same_company(connection.company_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.company_connections connection
  WHERE connection.id = provider_credentials.connection_id
    AND public.is_same_company(connection.company_id)
));

REVOKE ALL ON public.provider_credentials FROM anon;
REVOKE ALL ON public.provider_credentials FROM authenticated;
GRANT SELECT (id, connection_id, phone_number_id, business_account_id, token_expires_at, metadata, created_at, updated_at)
  ON public.provider_credentials TO authenticated;
GRANT INSERT (connection_id, phone_number_id, business_account_id, token_expires_at, metadata)
  ON public.provider_credentials TO authenticated;
GRANT UPDATE (phone_number_id, business_account_id, token_expires_at, metadata, updated_at)
  ON public.provider_credentials TO authenticated;

-- Run tenant-aware functions as the caller wherever elevated privileges are unnecessary.
ALTER FUNCTION public.is_same_company(uuid) SECURITY INVOKER;
ALTER FUNCTION public.criar_reserva_acervo(uuid, uuid, integer, date, date, text) SECURITY INVOKER;
ALTER FUNCTION public.criar_tarefas_padrao_evento() SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.criar_reserva_acervo(uuid, uuid, integer, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_reserva_acervo(uuid, uuid, integer, date, date, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.criar_tarefas_padrao_evento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_company_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_same_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_same_company(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_new_tenant(p_company_name text, p_user_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_profile_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Nao autorizado.'; END IF;
  IF p_company_name IS NULL OR length(btrim(p_company_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome da empresa invalido.';
  END IF;
  IF p_user_name IS NULL OR length(btrim(p_user_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome do usuario invalido.';
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE id = v_user_id AND (user_id IS NULL OR user_id = v_user_id)
  FOR UPDATE;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Perfil autenticado nao encontrado.'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Usuario ja pertence a uma empresa.';
  END IF;

  INSERT INTO public.companies (nome) VALUES (btrim(p_company_name)) RETURNING id INTO v_company_id;
  INSERT INTO public.company_settings (company_id, primary_color) VALUES (v_company_id, '#f97316');
  UPDATE public.profiles
  SET user_id = v_user_id, nome = btrim(p_user_name), role = 'admin', company_id = v_company_id
  WHERE id = v_user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_new_tenant(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_new_tenant(text, text) TO authenticated;

-- Demo users may inspect payment records but cannot create or change paid actions.
DROP POLICY IF EXISTS "Isolate tenant pagamentos" ON public.pagamentos;
CREATE POLICY "Tenant payment read" ON public.pagamentos
  FOR SELECT TO authenticated USING (public.is_same_company(company_id));
CREATE POLICY "Live tenant payment insert" ON public.pagamentos
  FOR INSERT TO authenticated WITH CHECK (
    public.is_same_company(company_id)
    AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = pagamentos.company_id AND c.is_demo)
  );
CREATE POLICY "Live tenant payment update" ON public.pagamentos
  FOR UPDATE TO authenticated
  USING (
    public.is_same_company(company_id)
    AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = pagamentos.company_id AND c.is_demo)
  )
  WITH CHECK (
    public.is_same_company(company_id)
    AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = pagamentos.company_id AND c.is_demo)
  );
CREATE POLICY "Live tenant payment delete" ON public.pagamentos
  FOR DELETE TO authenticated USING (
    public.is_same_company(company_id)
    AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = pagamentos.company_id AND c.is_demo)
  );

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE security_test_tenants AS
SELECT row_number() OVER (ORDER BY p.company_id, p.user_id) AS tenant_number, p.user_id, p.company_id
FROM public.profiles p
WHERE p.user_id IS NOT NULL AND p.company_id IS NOT NULL
ORDER BY p.company_id, p.user_id
LIMIT 2;

DO $$
BEGIN
  IF (SELECT count(*) FROM security_test_tenants) < 2 THEN
    RAISE EXCEPTION 'The hardening test requires two users from different tenants.';
  END IF;
  IF (SELECT count(DISTINCT company_id) FROM security_test_tenants) < 2 THEN
    RAISE EXCEPTION 'The hardening test requires two distinct tenants.';
  END IF;
  IF has_function_privilege('anon', 'public.criar_reserva_acervo(uuid,uuid,integer,date,date,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute criar_reserva_acervo.';
  END IF;
  IF has_function_privilege('anon', 'public.criar_tarefas_padrao_evento()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute the event task trigger function.';
  END IF;
  IF has_column_privilege('authenticated', 'public.provider_credentials', 'encrypted_access_token', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated can read provider access tokens.';
  END IF;
END $$;

GRANT SELECT ON security_test_tenants TO authenticated;
GRANT SELECT ON public.companies, public.deals, public.profiles TO authenticated;
GRANT UPDATE, DELETE ON public.deals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

INSERT INTO storage.objects (bucket_id, name)
SELECT 'Catalogo', company_id::text || '/security-test-a.txt'
FROM security_test_tenants WHERE tenant_number = 1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM security_test_tenants WHERE tenant_number = 2), true);

DO $$
DECLARE
  tenant_a uuid := (SELECT company_id FROM security_test_tenants WHERE tenant_number = 1);
  tenant_b uuid := (SELECT company_id FROM security_test_tenants WHERE tenant_number = 2);
  affected integer;
BEGIN
  IF (SELECT count(*) FROM public.companies WHERE id = tenant_b) <> 1 THEN
    RAISE EXCEPTION 'Tenant B cannot read its own company.';
  END IF;
  IF (SELECT count(*) FROM public.companies WHERE id = tenant_a) <> 0 THEN
    RAISE EXCEPTION 'Tenant B can read tenant A company.';
  END IF;
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id = 'Catalogo' AND name = tenant_a::text || '/security-test-a.txt') <> 1 THEN
    RAISE EXCEPTION 'Catalogo public read contract is broken.';
  END IF;

  UPDATE public.deals SET updated_at = updated_at
  WHERE company_id = tenant_a;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Tenant B can update tenant A deals.'; END IF;

  DELETE FROM public.deals WHERE company_id = tenant_a;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Tenant B can delete tenant A deals.'; END IF;
END $$;

INSERT INTO storage.objects (bucket_id, name)
SELECT 'Catalogo', company_id::text || '/security-test-b.txt'
FROM security_test_tenants WHERE tenant_number = 2;

DO $$
DECLARE affected integer;
BEGIN
  UPDATE storage.objects SET updated_at = now()
  WHERE bucket_id = 'Catalogo'
    AND name = (SELECT company_id::text FROM security_test_tenants WHERE tenant_number = 1) || '/security-test-a.txt';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Tenant B can update tenant A Storage objects.'; END IF;

  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'Catalogo'
      AND name = (SELECT company_id::text FROM security_test_tenants WHERE tenant_number = 1) || '/security-test-a.txt';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Tenant B can delete tenant A Storage objects.'; END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Tenant B can delete tenant A Storage objects.' THEN RAISE; END IF;
    -- Storage blocks direct table deletion; its API still evaluates the policy.
  END;
END $$;

RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE inserted boolean := false;
BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('Catalogo', 'anonymous/security-test.txt');
    inserted := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF inserted THEN RAISE EXCEPTION 'anon can write to Catalogo.'; END IF;
END $$;

RESET ROLE;
ROLLBACK;

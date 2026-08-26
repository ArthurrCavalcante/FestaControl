-- New tenants are assembled across multiple statements, so this check must run
-- at transaction end rather than immediately after the company INSERT.
CREATE OR REPLACE FUNCTION private.assert_company_has_member(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id)
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE company_id = p_company_id)
  THEN
    RAISE EXCEPTION 'Company % must have at least one member.', p_company_id
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_company_has_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'companies' THEN
    v_company_id := NEW.id;
  ELSE
    v_company_id := OLD.company_id;
  END IF;

  IF v_company_id IS NOT NULL THEN
    PERFORM private.assert_company_has_member(v_company_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS companies_require_member ON public.companies;
CREATE CONSTRAINT TRIGGER companies_require_member
AFTER INSERT OR UPDATE ON public.companies
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.enforce_company_has_member();

DROP TRIGGER IF EXISTS profiles_preserve_company_member ON public.profiles;
CREATE CONSTRAINT TRIGGER profiles_preserve_company_member
AFTER DELETE OR UPDATE OF company_id ON public.profiles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.enforce_company_has_member();

CREATE OR REPLACE VIEW private.orphan_tenant_audit
WITH (security_invoker = true)
AS
SELECT
  company.id AS company_id,
  company.created_at,
  company.is_demo,
  (SELECT count(*) FROM public.profiles profile WHERE profile.company_id = company.id) AS member_count,
  (SELECT count(*) FROM public.events event WHERE event.company_id = company.id) AS event_count,
  (SELECT count(*) FROM public.deals deal WHERE deal.company_id = company.id) AS deal_count,
  (SELECT count(*) FROM public.leads lead WHERE lead.company_id = company.id) AS lead_count,
  (SELECT count(*) FROM public.conversations conversation WHERE conversation.company_id = company.id) AS conversation_count
FROM public.companies company
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles profile WHERE profile.company_id = company.id
);

REVOKE ALL ON FUNCTION private.assert_company_has_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_company_has_member() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.orphan_tenant_audit FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.assert_company_has_member(uuid) TO service_role;
GRANT SELECT ON private.orphan_tenant_audit TO service_role;

COMMENT ON VIEW private.orphan_tenant_audit IS
  'Internal audit only. Existing legacy rows are reported but never deleted automatically.';

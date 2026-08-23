-- Serialize team limits and reject cross-tenant references even for direct API clients.

CREATE OR REPLACE FUNCTION public.enforce_team_member_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE member_count integer;
BEGIN
  IF NEW.company_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id) THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text, 0));
  SELECT count(*) INTO member_count FROM public.profiles
    WHERE company_id = NEW.company_id AND id <> NEW.id;
  IF member_count >= 3 THEN RAISE EXCEPTION 'Team limit reached.'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_team_member_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_team_member_limit ON public.profiles;
CREATE TRIGGER enforce_team_member_limit BEFORE INSERT OR UPDATE OF company_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_member_limit();

CREATE OR REPLACE FUNCTION public.guard_proposal_tenant_references() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.deal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.deals WHERE id = NEW.deal_id AND company_id = NEW.company_id
  ) THEN RAISE EXCEPTION 'Deal not found.'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_proposal_tenant_references() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_proposal_tenant_references ON public.proposals;
CREATE TRIGGER guard_proposal_tenant_references BEFORE INSERT OR UPDATE OF company_id, deal_id ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.guard_proposal_tenant_references();

CREATE OR REPLACE FUNCTION public.guard_proposal_item_tenant_references() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.proposals WHERE id = NEW.proposal_id AND company_id = NEW.company_id
  ) THEN RAISE EXCEPTION 'Proposal not found.'; END IF;
  IF NEW.acervo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.acervo WHERE id = NEW.acervo_id AND company_id = NEW.company_id
  ) THEN RAISE EXCEPTION 'Inventory item not found.'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_proposal_item_tenant_references() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_proposal_item_tenant_references ON public.proposal_items;
CREATE TRIGGER guard_proposal_item_tenant_references BEFORE INSERT OR UPDATE OF company_id, proposal_id, acervo_id ON public.proposal_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_proposal_item_tenant_references();

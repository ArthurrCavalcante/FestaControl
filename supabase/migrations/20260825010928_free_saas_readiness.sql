-- Free SaaS readiness: private authorization helpers, safe tenant bootstrap and product telemetry.

ALTER TABLE public.product_events DROP CONSTRAINT IF EXISTS product_events_event_name_check;
ALTER TABLE public.product_events ADD CONSTRAINT product_events_event_name_check CHECK (event_name = ANY (ARRAY[
  'app_opened', 'page_viewed', 'onboarding_completed', 'onboarding_step_completed',
  'proposal_created', 'proposal_sent', 'proposal_viewed', 'proposal_accepted',
  'deposit_received', 'event_completed', 'whatsapp_connection_started',
  'whatsapp_connected', 'whatsapp_message_sent', 'whatsapp_auto_reply_sent',
  'invitation_accepted'
]));

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.current_company_id()') IS NOT NULL THEN
    ALTER FUNCTION public.current_company_id() SET SCHEMA private;
  END IF;
  IF to_regprocedure('public.current_user_role()') IS NOT NULL THEN
    ALTER FUNCTION public.current_user_role() SET SCHEMA private;
  END IF;
  IF to_regprocedure('public.is_platform_admin()') IS NOT NULL THEN
    ALTER FUNCTION public.is_platform_admin() SET SCHEMA private;
  END IF;
  IF to_regprocedure('public.company_can_write(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.company_can_write(uuid) SET SCHEMA private;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.company_can_write(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
  SELECT target_company_id = private.current_company_id()
    AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = target_company_id AND c.is_demo)
    AND EXISTS (
      SELECT 1 FROM public.company_subscriptions subscription
      WHERE subscription.company_id = target_company_id
        AND (
          subscription.status = 'active'
          OR (subscription.status = 'trialing' AND subscription.trial_ends_at > now())
          OR (subscription.status = 'past_due' AND subscription.grace_ends_at > now())
        )
    )
$$;

REVOKE ALL ON FUNCTION private.current_company_id(), private.current_user_role(),
  private.is_platform_admin(), private.company_can_write(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_company_id(), private.current_user_role(),
  private.is_platform_admin(), private.company_can_write(uuid) TO authenticated, service_role;

-- Compatibility wrappers keep existing routines working while privileged helpers stay
-- outside the PostgREST-exposed public schema.
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'private', 'pg_temp'
AS $$ SELECT private.current_company_id() $$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'private', 'pg_temp'
AS $$ SELECT private.current_user_role() $$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'private', 'pg_temp'
AS $$ SELECT private.is_platform_admin() $$;

CREATE OR REPLACE FUNCTION public.company_can_write(target_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'private', 'pg_temp'
AS $$ SELECT private.company_can_write(target_company_id) $$;

REVOKE ALL ON FUNCTION public.current_company_id(), public.current_user_role(),
  public.is_platform_admin(), public.company_can_write(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_id(), public.current_user_role(),
  public.is_platform_admin(), public.company_can_write(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_new_tenant(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_new_tenant(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_new_tenant_for_user(
  p_user_id uuid,
  p_company_name text,
  p_user_name text,
  p_phone text DEFAULT NULL,
  p_pix_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_company_id uuid;
  v_profile_id uuid;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Nao autorizado.';
  END IF;
  IF p_company_name IS NULL OR length(btrim(p_company_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome da empresa invalido.';
  END IF;
  IF p_user_name IS NULL OR length(btrim(p_user_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome do usuario invalido.';
  END IF;
  IF p_phone IS NOT NULL AND length(btrim(p_phone)) > 200 THEN RAISE EXCEPTION 'Telefone invalido.'; END IF;
  IF p_pix_key IS NOT NULL AND length(btrim(p_pix_key)) > 200 THEN RAISE EXCEPTION 'Chave PIX invalida.'; END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Perfil autenticado nao encontrado.'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_profile_id AND company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Usuario ja pertence a uma empresa.';
  END IF;

  INSERT INTO public.companies(nome) VALUES (btrim(p_company_name)) RETURNING id INTO v_company_id;
  INSERT INTO public.company_settings(company_id, primary_color, telefone, pix_key)
    VALUES (v_company_id, '#f97316', nullif(btrim(p_phone), ''), nullif(btrim(p_pix_key), ''));
  INSERT INTO public.company_subscriptions(company_id, status, trial_ends_at)
    VALUES (v_company_id, 'trialing', now() + interval '14 days');
  UPDATE public.profiles SET nome = btrim(p_user_name), role = 'owner', company_id = v_company_id
    WHERE id = v_profile_id;
  INSERT INTO public.product_events(company_id, user_id, event_name, properties)
    VALUES (v_company_id, p_user_id, 'onboarding_completed', jsonb_build_object(
      'has_phone', nullif(btrim(p_phone), '') IS NOT NULL,
      'has_pix', nullif(btrim(p_pix_key), '') IS NOT NULL
    ));
  RETURN v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_new_tenant_for_user(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_new_tenant_for_user(uuid, text, text, text, text) TO service_role;

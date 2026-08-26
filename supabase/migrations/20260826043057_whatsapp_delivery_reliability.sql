CREATE TABLE public.whatsapp_automation_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  automation_name text NOT NULL CHECK (length(automation_name) BETWEEN 1 AND 80),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'failed')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 3),
  provider_message_id text,
  last_error text,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, conversation_id, automation_name)
);

ALTER TABLE public.whatsapp_automation_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_automation_deliveries FROM PUBLIC, anon, authenticated;

CREATE INDEX whatsapp_automation_deliveries_company_id_idx
  ON public.whatsapp_automation_deliveries(company_id);

CREATE OR REPLACE FUNCTION private.claim_whatsapp_automation(
  p_company_id uuid,
  p_conversation_id uuid,
  p_automation_name text,
  p_max_attempts integer DEFAULT 3
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_delivery_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_conversation_id IS NULL
    OR p_automation_name IS NULL OR length(btrim(p_automation_name)) NOT BETWEEN 1 AND 80
    OR p_max_attempts NOT BETWEEN 1 AND 3
  THEN
    RAISE EXCEPTION 'Invalid automation delivery claim.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conversation_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.whatsapp_automation_deliveries (
    company_id, conversation_id, automation_name
  ) VALUES (
    p_company_id, p_conversation_id, btrim(p_automation_name)
  )
  ON CONFLICT (company_id, conversation_id, automation_name) DO UPDATE
    SET status = 'processing',
        attempt_count = public.whatsapp_automation_deliveries.attempt_count + 1,
        last_error = NULL,
        next_attempt_at = NULL,
        updated_at = now()
    WHERE public.whatsapp_automation_deliveries.status = 'failed'
      AND public.whatsapp_automation_deliveries.attempt_count < p_max_attempts
      AND coalesce(public.whatsapp_automation_deliveries.next_attempt_at, '-infinity'::timestamptz) <= now()
  RETURNING id INTO v_delivery_id;

  RETURN v_delivery_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.finish_whatsapp_automation(
  p_delivery_id uuid,
  p_status text,
  p_detail text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF p_status NOT IN ('sent', 'failed') THEN
    RAISE EXCEPTION 'Invalid automation delivery status.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.whatsapp_automation_deliveries
  SET status = p_status,
      provider_message_id = CASE WHEN p_status = 'sent' THEN left(p_detail, 500) ELSE provider_message_id END,
      last_error = CASE WHEN p_status = 'failed' THEN left(p_detail, 500) ELSE NULL END,
      next_attempt_at = CASE WHEN p_status = 'failed' THEN now() + interval '30 seconds' ELSE NULL END,
      updated_at = now()
  WHERE id = p_delivery_id AND status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION private.claim_whatsapp_automation(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.finish_whatsapp_automation(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.claim_whatsapp_automation(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION private.finish_whatsapp_automation(uuid, text, text) TO service_role;

-- Public wrappers keep the Edge Function contract stable while the privileged
-- implementation remains unavailable to browser roles.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_automation(
  p_company_id uuid,
  p_conversation_id uuid,
  p_automation_name text,
  p_max_attempts integer DEFAULT 3
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'private', 'pg_temp'
AS $$
  SELECT private.claim_whatsapp_automation(p_company_id, p_conversation_id, p_automation_name, p_max_attempts)
$$;

CREATE OR REPLACE FUNCTION public.finish_whatsapp_automation(
  p_delivery_id uuid,
  p_status text,
  p_detail text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'private', 'pg_temp'
AS $$
  SELECT private.finish_whatsapp_automation(p_delivery_id, p_status, p_detail)
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_automation(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_whatsapp_automation(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_automation(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_whatsapp_automation(uuid, text, text) TO service_role;

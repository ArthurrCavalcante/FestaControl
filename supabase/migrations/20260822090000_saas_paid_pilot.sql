-- FestaControl paid pilot: schema reconciliation, entitlements, proposals and product telemetry.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS whatsapp_status text NOT NULL DEFAULT 'disconnected'
    CHECK (whatsapp_status IN ('disconnected', 'connecting', 'connected', 'error')),
  ADD COLUMN IF NOT EXISTS whatsapp_qr_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_last_error text,
  ADD COLUMN IF NOT EXISTS whatsapp_failure_count integer NOT NULL DEFAULT 0 CHECK (whatsapp_failure_count >= 0),
  ADD COLUMN IF NOT EXISTS whatsapp_breaker_until timestamptz;

CREATE TEMP TABLE conversation_dedup ON COMMIT DROP AS
SELECT id AS duplicate_id,
       first_value(id) OVER (
         PARTITION BY company_id, canal, remetente_id
         ORDER BY last_activity DESC NULLS LAST, created_at DESC NULLS LAST, id
       ) AS keeper_id,
       row_number() OVER (
         PARTITION BY company_id, canal, remetente_id
         ORDER BY last_activity DESC NULLS LAST, created_at DESC NULLS LAST, id
       ) AS duplicate_rank
FROM public.conversations;

UPDATE public.messages message
SET conversation_id = dedup.keeper_id
FROM conversation_dedup dedup
WHERE dedup.duplicate_rank > 1 AND message.conversation_id = dedup.duplicate_id;

DELETE FROM public.conversations conversation
USING conversation_dedup dedup
WHERE dedup.duplicate_rank > 1 AND conversation.id = dedup.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_canal_remetente
  ON public.conversations(company_id, canal, remetente_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_message
  ON public.messages(company_id, provider_message_id) WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE public.profiles SET role = CASE WHEN role = 'admin' THEN 'owner' ELSE 'staff' END
WHERE role IS NULL OR role NOT IN ('owner', 'manager', 'staff');
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'staff';
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'manager', 'staff'));

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_code text NOT NULL DEFAULT 'founder_99' CHECK (plan_code = 'founder_99'),
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'canceled')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  trial_ends_at timestamptz,
  grace_ends_at timestamptz,
  read_only_until timestamptz,
  current_period_end timestamptz,
  billing_provider text,
  external_subscription_id text,
  message_period_started_at timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  outbound_messages integer NOT NULL DEFAULT 0 CHECK (outbound_messages >= 0),
  inbound_messages integer NOT NULL DEFAULT 0 CHECK (inbound_messages >= 0),
  support_minutes integer NOT NULL DEFAULT 0 CHECK (support_minutes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'staff')),
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_pending_email
  ON public.team_invitations(company_id, lower(email)) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'confirmed')),
  customer_name text NOT NULL CHECK (length(btrim(customer_name)) BETWEEN 2 AND 160),
  customer_phone text,
  event_date date,
  event_address text,
  theme text,
  valid_until date NOT NULL DEFAULT current_date + 7,
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  estimated_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  terms text,
  public_token_hash text NOT NULL UNIQUE CHECK (length(public_token_hash) = 64),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  confirmed_at timestamptz,
  accepted_ip_prefix text,
  accepted_user_agent text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, deal_id, version)
);

CREATE TABLE IF NOT EXISTS public.proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  acervo_id uuid REFERENCES public.acervo(id) ON DELETE SET NULL,
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 300),
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  image_path text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('material', 'transport', 'staff', 'supplier', 'loss', 'other')),
  description text NOT NULL,
  estimated_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (estimated_amount >= 0),
  actual_amount numeric(12,2) CHECK (actual_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.acervo_reservas(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('outbound', 'returned', 'damaged', 'lost')),
  quantity integer NOT NULL CHECK (quantity > 0),
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  movement_id uuid REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
  incident_type text NOT NULL CHECK (incident_type IN ('damage', 'loss')),
  description text NOT NULL,
  charge_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (charge_amount >= 0),
  photo_path text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL CHECK (event_name IN (
    'onboarding_completed', 'proposal_created', 'proposal_sent', 'proposal_viewed',
    'proposal_accepted', 'deposit_received', 'event_completed', 'whatsapp_connected',
    'invitation_accepted'
  )),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposals_company_status ON public.proposals(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS proposal_items_proposal ON public.proposal_items(proposal_id, sort_order);
CREATE INDEX IF NOT EXISTS event_costs_event ON public.event_costs(event_id, category);
CREATE INDEX IF NOT EXISTS inventory_movements_event ON public.inventory_movements(event_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS inventory_incidents_event ON public.inventory_incidents(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_events_company_time ON public.product_events(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS company_connections_company_id ON public.company_connections(company_id);
CREATE INDEX IF NOT EXISTS conversations_company_id ON public.conversations(company_id);
CREATE INDEX IF NOT EXISTS deals_company_id ON public.deals(company_id);
CREATE INDEX IF NOT EXISTS events_company_id ON public.events(company_id);
CREATE INDEX IF NOT EXISTS leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS messages_company_id ON public.messages(company_id);
CREATE INDEX IF NOT EXISTS profiles_company_id ON public.profiles(company_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'company_subscriptions', 'team_invitations', 'proposals', 'event_costs'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON public.%I', table_name);
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.company_can_write(target_company_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT target_company_id = public.current_company_id()
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

CREATE OR REPLACE FUNCTION public.guard_accepted_proposal() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status NOT IN ('accepted', 'confirmed') THEN RETURN NEW; END IF;
  IF OLD.status = 'accepted' AND NEW.status = 'confirmed'
     AND (to_jsonb(NEW) - ARRAY['status', 'confirmed_at', 'updated_at']) =
         (to_jsonb(OLD) - ARRAY['status', 'confirmed_at', 'updated_at']) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Accepted proposal versions are immutable.';
END;
$$;

DROP TRIGGER IF EXISTS guard_accepted_proposal ON public.proposals;
CREATE TRIGGER guard_accepted_proposal BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.guard_accepted_proposal();

CREATE OR REPLACE FUNCTION public.guard_accepted_proposal_item() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE target_proposal_id uuid := coalesce(NEW.proposal_id, OLD.proposal_id);
BEGIN
  IF EXISTS (SELECT 1 FROM public.proposals WHERE id = target_proposal_id AND status IN ('accepted', 'confirmed')) THEN
    RAISE EXCEPTION 'Items from accepted proposal versions are immutable.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_accepted_proposal_item ON public.proposal_items;
CREATE TRIGGER guard_accepted_proposal_item BEFORE UPDATE OR DELETE ON public.proposal_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_accepted_proposal_item();

CREATE OR REPLACE FUNCTION public.confirm_proposal_deposit(
  p_proposal_id uuid,
  p_amount numeric,
  p_method text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  proposal_record public.proposals%ROWTYPE;
  v_event_id uuid;
BEGIN
  IF public.current_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Manager permission required.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid deposit amount.'; END IF;

  SELECT * INTO proposal_record FROM public.proposals
  WHERE id = p_proposal_id AND company_id = public.current_company_id() FOR UPDATE;
  IF proposal_record.id IS NULL THEN RAISE EXCEPTION 'Proposal not found.'; END IF;
  IF NOT public.company_can_write(proposal_record.company_id) THEN RAISE EXCEPTION 'Subscription is read-only.'; END IF;

  SELECT events.id INTO v_event_id FROM public.events WHERE deal_id = proposal_record.deal_id LIMIT 1;
  IF proposal_record.status = 'confirmed' THEN RETURN v_event_id; END IF;
  IF proposal_record.status <> 'accepted' THEN RAISE EXCEPTION 'Proposal must be accepted first.'; END IF;
  IF proposal_record.deal_id IS NULL OR proposal_record.event_date IS NULL THEN
    RAISE EXCEPTION 'Proposal needs a deal and event date.';
  END IF;

  IF v_event_id IS NULL THEN
    INSERT INTO public.events(company_id, deal_id, data_evento, horario, endereco, status_operacional)
    VALUES (proposal_record.company_id, proposal_record.deal_id, proposal_record.event_date,
            'A definir', proposal_record.event_address, 'AGUARDANDO')
    RETURNING id INTO v_event_id;
  ELSE
    UPDATE public.events SET data_evento = proposal_record.event_date,
      endereco = coalesce(proposal_record.event_address, endereco), status_operacional = 'AGUARDANDO'
    WHERE id = v_event_id;
  END IF;

  INSERT INTO public.pagamentos(company_id, deal_id, event_id, descricao, tipo, valor, pago_em, status, metodo)
  VALUES (proposal_record.company_id, proposal_record.deal_id, v_event_id, 'Sinal da proposta',
          'SINAL', p_amount, now(), 'PAGO', nullif(btrim(p_method), ''));

  INSERT INTO public.acervo_reservas(company_id, event_id, acervo_id, quantidade, data_inicio, data_fim, observacoes)
  SELECT item.company_id, v_event_id, item.acervo_id, ceil(item.quantity)::integer,
         proposal_record.event_date, proposal_record.event_date, 'Reserva gerada pela proposta aceita'
  FROM public.proposal_items item
  WHERE item.proposal_id = proposal_record.id AND item.acervo_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.acervo_reservas reservation
      WHERE reservation.event_id = v_event_id AND reservation.acervo_id = item.acervo_id
        AND reservation.status <> 'CANCELADO'
    );

  UPDATE public.proposals SET status = 'confirmed', confirmed_at = now() WHERE id = proposal_record.id;
  UPDATE public.deals SET status_funil = 'CONFIRMADO', proposta_status = 'APROVADA',
    proposta_aceita_em = proposal_record.accepted_at, confirmado_em = now(),
    data_festa = proposal_record.event_date, valor_total = proposal_record.total,
    custo_estimado = proposal_record.estimated_cost
  WHERE id = proposal_record.deal_id AND company_id = proposal_record.company_id;
  INSERT INTO public.product_events(company_id, user_id, event_name, properties)
  VALUES (proposal_record.company_id, auth.uid(), 'deposit_received', jsonb_build_object('proposal_id', proposal_record.id));
  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_whatsapp_delivery(p_company_id uuid, p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_failures integer;
BEGIN
  IF auth.role() <> 'service_role' AND p_company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;
  IF p_success THEN
    UPDATE public.company_settings SET whatsapp_failure_count = 0, whatsapp_breaker_until = NULL,
      whatsapp_last_error = NULL WHERE company_id = p_company_id;
    UPDATE public.company_subscriptions SET outbound_messages = outbound_messages + 1
      WHERE company_id = p_company_id;
  ELSE
    SELECT whatsapp_failure_count INTO current_failures FROM public.company_settings
      WHERE company_id = p_company_id FOR UPDATE;
    current_failures := coalesce(current_failures, 0) + 1;
    UPDATE public.company_settings SET whatsapp_failure_count = current_failures,
      whatsapp_breaker_until = CASE WHEN current_failures >= 3 THEN now() + interval '5 minutes' ELSE whatsapp_breaker_until END,
      whatsapp_last_error = 'Provider temporarily unavailable'
    WHERE company_id = p_company_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_inbound_message(p_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Unauthorized.'; END IF;
  UPDATE public.company_subscriptions SET inbound_messages = inbound_messages + 1
    WHERE company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_can_write(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_proposal_deposit(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_whatsapp_delivery(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_inbound_message(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_can_write(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_proposal_deposit(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_delivery(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_inbound_message(uuid) TO service_role;

ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant reads subscription" ON public.company_subscriptions
  FOR SELECT TO authenticated USING (company_id = public.current_company_id() OR public.is_platform_admin());
CREATE POLICY "Platform admins manage subscriptions" ON public.company_subscriptions
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Platform admin identity" ON public.platform_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners read invitations" ON public.team_invitations
  FOR SELECT TO authenticated USING (company_id = public.current_company_id() AND public.current_user_role() = 'owner');
CREATE POLICY "Tenant proposals" ON public.proposals
  FOR ALL TO authenticated USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id() AND public.company_can_write(company_id));
CREATE POLICY "Tenant proposal items" ON public.proposal_items
  FOR ALL TO authenticated USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id() AND public.company_can_write(company_id));
CREATE POLICY "Tenant event costs" ON public.event_costs
  FOR ALL TO authenticated USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id() AND public.company_can_write(company_id));
CREATE POLICY "Tenant inventory movements" ON public.inventory_movements
  FOR ALL TO authenticated USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id() AND public.company_can_write(company_id));
CREATE POLICY "Tenant inventory incidents" ON public.inventory_incidents
  FOR ALL TO authenticated USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id() AND public.company_can_write(company_id));
CREATE POLICY "Tenant product events" ON public.product_events
  FOR SELECT TO authenticated USING (company_id = public.current_company_id() OR public.is_platform_admin());
CREATE POLICY "Tenant records product events" ON public.product_events
  FOR INSERT TO authenticated WITH CHECK (
    company_id = public.current_company_id() AND (user_id IS NULL OR user_id = auth.uid())
  );

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'leads', 'deals', 'events', 'catalogo_fotos', 'caixa_entrada', 'acervo', 'kits',
    'acervo_composicao', 'conversations', 'messages', 'pagamentos', 'event_tasks',
    'acervo_reservas', 'company_settings', 'proposals', 'proposal_items', 'event_costs',
    'inventory_movements', 'inventory_incidents'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Subscription insert guard" ON public.%I', table_name);
      EXECUTE format('DROP POLICY IF EXISTS "Subscription update guard" ON public.%I', table_name);
      EXECUTE format('DROP POLICY IF EXISTS "Subscription delete guard" ON public.%I', table_name);
      EXECUTE format('CREATE POLICY "Subscription insert guard" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.company_can_write(company_id))', table_name);
      EXECUTE format('CREATE POLICY "Subscription update guard" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.company_can_write(company_id)) WITH CHECK (public.company_can_write(company_id))', table_name);
      EXECUTE format('CREATE POLICY "Subscription delete guard" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.company_can_write(company_id))', table_name);
    END IF;
  END LOOP;
END $$;

INSERT INTO public.company_subscriptions(company_id, status, trial_ends_at, current_period_end)
SELECT company.id,
       CASE WHEN EXISTS (SELECT 1 FROM public.profiles profile WHERE profile.company_id = company.id)
            THEN 'active' ELSE 'trialing' END,
       now() + interval '14 days',
       CASE WHEN EXISTS (SELECT 1 FROM public.profiles profile WHERE profile.company_id = company.id)
            THEN now() + interval '100 years' ELSE NULL END
FROM public.companies company
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO public.platform_admins(user_id)
SELECT profile.user_id
FROM public.profiles profile
JOIN public.companies company ON company.id = profile.company_id
WHERE NOT coalesce(company.is_demo, false) AND profile.user_id IS NOT NULL
ORDER BY profile.updated_at NULLS LAST, profile.user_id
LIMIT 1
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_new_tenant(p_company_name text, p_user_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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

  SELECT id INTO v_profile_id FROM public.profiles
  WHERE user_id = v_user_id FOR UPDATE;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Perfil autenticado nao encontrado.'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_profile_id AND company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Usuario ja pertence a uma empresa.';
  END IF;

  INSERT INTO public.companies(nome) VALUES (btrim(p_company_name)) RETURNING id INTO v_company_id;
  INSERT INTO public.company_settings(company_id, primary_color) VALUES (v_company_id, '#f97316');
  INSERT INTO public.company_subscriptions(company_id, status, trial_ends_at)
  VALUES (v_company_id, 'trialing', now() + interval '14 days');
  UPDATE public.profiles SET nome = btrim(p_user_name), role = 'owner', company_id = v_company_id
  WHERE id = v_profile_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_new_tenant(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_new_tenant(text, text) TO authenticated;

REVOKE ALL ON public.company_subscriptions, public.platform_admins, public.team_invitations,
  public.proposals, public.proposal_items, public.event_costs, public.inventory_movements,
  public.inventory_incidents, public.product_events FROM anon;
GRANT SELECT ON public.company_subscriptions, public.platform_admins, public.team_invitations,
  public.product_events TO authenticated;
GRANT INSERT ON public.product_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals, public.proposal_items, public.event_costs,
  public.inventory_movements, public.inventory_incidents TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.product_events_id_seq TO authenticated;

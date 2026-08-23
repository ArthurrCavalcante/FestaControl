-- Remove client access to provider metrics and avoid overlapping subscription SELECT policies.

REVOKE EXECUTE ON FUNCTION public.record_whatsapp_delivery(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_delivery(uuid, boolean) TO service_role;

DROP POLICY IF EXISTS "Platform admins manage subscriptions" ON public.company_subscriptions;
CREATE POLICY "Platform admins insert subscriptions" ON public.company_subscriptions
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());
CREATE POLICY "Platform admins update subscriptions" ON public.company_subscriptions
  FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Platform admins delete subscriptions" ON public.company_subscriptions
  FOR DELETE TO authenticated USING (public.is_platform_admin());

CREATE INDEX IF NOT EXISTS event_costs_company_id ON public.event_costs(company_id);
CREATE INDEX IF NOT EXISTS inventory_movements_company_id ON public.inventory_movements(company_id);
CREATE INDEX IF NOT EXISTS inventory_movements_reservation_id ON public.inventory_movements(reservation_id);
CREATE INDEX IF NOT EXISTS inventory_incidents_company_id ON public.inventory_incidents(company_id);
CREATE INDEX IF NOT EXISTS inventory_incidents_movement_id ON public.inventory_incidents(movement_id);
CREATE INDEX IF NOT EXISTS proposal_items_company_id ON public.proposal_items(company_id);
CREATE INDEX IF NOT EXISTS proposal_items_acervo_id ON public.proposal_items(acervo_id);
CREATE INDEX IF NOT EXISTS proposals_deal_id ON public.proposals(deal_id);
CREATE INDEX IF NOT EXISTS team_invitations_invited_by ON public.team_invitations(invited_by);
CREATE INDEX IF NOT EXISTS team_invitations_accepted_by ON public.team_invitations(accepted_by);

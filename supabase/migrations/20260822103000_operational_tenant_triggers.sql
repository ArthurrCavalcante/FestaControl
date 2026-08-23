-- Fill tenant ids for authenticated operational writes while keeping RLS authoritative.

DROP TRIGGER IF EXISTS set_event_costs_company_id ON public.event_costs;
CREATE TRIGGER set_event_costs_company_id BEFORE INSERT ON public.event_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_inventory_movements_company_id ON public.inventory_movements;
CREATE TRIGGER set_inventory_movements_company_id BEFORE INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_inventory_incidents_company_id ON public.inventory_incidents;
CREATE TRIGGER set_inventory_incidents_company_id BEFORE INSERT ON public.inventory_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

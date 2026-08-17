-- Cria um checklist operacional padrão quando uma festa é confirmada.
CREATE OR REPLACE FUNCTION public.criar_tarefas_padrao_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.event_tasks (company_id, event_id, titulo, etapa, prazo)
  VALUES
    (NEW.company_id, NEW.id, 'Separar itens reservados', 'SEPARACAO', NEW.data_evento::timestamptz - interval '1 day'),
    (NEW.company_id, NEW.id, 'Confirmar entrega com o cliente', 'ENTREGA', NEW.data_evento::timestamptz - interval '1 day'),
    (NEW.company_id, NEW.id, 'Realizar montagem', 'MONTAGEM', NEW.data_evento::timestamptz),
    (NEW.company_id, NEW.id, 'Realizar desmontagem', 'DESMONTAGEM', NEW.data_evento::timestamptz + interval '1 day'),
    (NEW.company_id, NEW.id, 'Conferir retorno e avarias', 'RETIRADA', NEW.data_evento::timestamptz + interval '1 day');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_tarefas_padrao_evento() FROM PUBLIC;

DROP TRIGGER IF EXISTS create_default_event_tasks ON public.events;
CREATE TRIGGER create_default_event_tasks
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.criar_tarefas_padrao_evento();

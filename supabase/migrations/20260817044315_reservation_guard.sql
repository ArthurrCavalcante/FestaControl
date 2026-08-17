-- Reserva atômica: evita que dois atendentes reservem o mesmo item além da quantidade disponível.
CREATE OR REPLACE FUNCTION public.criar_reserva_acervo(
  p_event_id uuid,
  p_acervo_id uuid,
  p_quantidade integer,
  p_data_inicio date,
  p_data_fim date,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_total integer;
  v_reservado bigint;
  v_reserva_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado.';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 OR p_data_fim < p_data_inicio THEN
    RAISE EXCEPTION 'Dados de reserva inválidos.';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF v_company_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND company_id = v_company_id)
    OR NOT EXISTS (SELECT 1 FROM public.acervo WHERE id = p_acervo_id AND company_id = v_company_id AND ativo = true) THEN
    RAISE EXCEPTION 'Evento ou item não pertence à sua empresa.';
  END IF;

  -- Serializa reservas do mesmo item durante a transação.
  PERFORM pg_advisory_xact_lock(hashtext(p_acervo_id::text));

  SELECT quantidade_total INTO v_total
  FROM public.acervo
  WHERE id = p_acervo_id;

  SELECT COALESCE(SUM(quantidade), 0) INTO v_reservado
  FROM public.acervo_reservas
  WHERE acervo_id = p_acervo_id
    AND status IN ('RESERVADO', 'SEPARADO', 'ENTREGUE')
    AND data_inicio <= p_data_fim
    AND data_fim >= p_data_inicio;

  IF v_reservado + p_quantidade > v_total THEN
    RAISE EXCEPTION 'Quantidade indisponível para o período selecionado.';
  END IF;

  INSERT INTO public.acervo_reservas (
    company_id, event_id, acervo_id, quantidade, data_inicio, data_fim, observacoes
  ) VALUES (
    v_company_id, p_event_id, p_acervo_id, p_quantidade, p_data_inicio, p_data_fim, p_observacoes
  ) RETURNING id INTO v_reserva_id;

  RETURN v_reserva_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_reserva_acervo(uuid, uuid, integer, date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_reserva_acervo(uuid, uuid, integer, date, date, text) TO authenticated;

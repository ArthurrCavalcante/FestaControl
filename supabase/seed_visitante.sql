-- Script para popular os dados de demonstração da conta de Visitante (FestaFlow Demo)
-- ATENÇÃO: ANTES DE RODAR ESTE SCRIPT, CRIE O USUÁRIO visitante@festaflow.com NO PAINEL AUTH DO SUPABASE.

DO $$
DECLARE
  v_user_id UUID;
  v_company_id UUID := '00000000-0000-0000-0000-000000000001'; -- UUID estático para a empresa Demo
  
  v_lead_joao UUID := gen_random_uuid();
  v_lead_maria UUID := gen_random_uuid();
  v_lead_carlos UUID := gen_random_uuid();
  v_lead_ana UUID := gen_random_uuid();
  v_lead_pedro UUID := gen_random_uuid();
  
  v_deal_joao UUID := gen_random_uuid();
  v_deal_maria UUID := gen_random_uuid();
  v_deal_carlos UUID := gen_random_uuid();
  v_deal_ana UUID := gen_random_uuid();
  v_deal_pedro UUID := gen_random_uuid();
BEGIN
  -- 1. Buscar o ID do usuário visitante cadastrado no Auth
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'visitante@festaflow.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário visitante@festaflow.com não encontrado. Crie o usuário primeiro no painel Authentication do Supabase.';
  END IF;

  -- 2. Garantir que a empresa Demo existe na tabela de empresas
  INSERT INTO public.companies (id, nome)
  VALUES (v_company_id, 'Visitante (Modo Demonstração)')
  ON CONFLICT (id) DO UPDATE SET nome = 'Visitante (Modo Demonstração)';

  -- 3. Garantir que as configurações da empresa existem
  INSERT INTO public.company_settings (company_id, primary_color)
  VALUES (v_company_id, '#8b5cf6')
  ON CONFLICT (company_id) DO NOTHING;

  -- 4. Vincular o usuário visitante à empresa Demo
  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (v_user_id, v_company_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET company_id = v_company_id;

  -- 5. Inserir Leads de Teste
  INSERT INTO public.leads (id, nome, telefone, origem) VALUES
    (v_lead_joao, 'João Silva (Demo)', '11999999999', 'Instagram'),
    (v_lead_maria, 'Maria Souza (Demo)', '11988888888', 'Google'),
    (v_lead_carlos, 'Carlos Oliveira (Demo)', '11977777777', 'Indicação'),
    (v_lead_ana, 'Ana Beatriz (Demo)', '11966666666', 'WhatsApp'),
    (v_lead_pedro, 'Pedro Santos (Demo)', '11955555555', 'Facebook')
  ON CONFLICT (id) DO NOTHING;

  -- 6. Inserir Deals de Teste (Funil de Vendas)
  INSERT INTO public.deals (id, lead_id, status_funil, modalidade, tema, valor_total, data_festa, endereco, itens_selecionados) VALUES
    (v_deal_joao, v_lead_joao, 'NOVOS', 'PEGUE_MONTE', 'Safari', 350.00, current_date + interval '10 days', 'A Combinar', '["Painel Redondo", "Cilindros", "Personagens M"]'),
    (v_deal_maria, v_lead_maria, 'NEGOCIACAO', 'FRETADA', 'Princesas', 850.00, current_date + interval '15 days', 'Rua das Flores, 123 - Salão', '["Arco de Balões", "Mesa Provençal", "Painel Retangular"]'),
    (v_deal_carlos, v_lead_carlos, 'SINAL', 'PEGUE_MONTE', 'Minecraft', 400.00, current_date + interval '5 days', 'A Combinar', '["Painel Quadrado", "Cilindros M", "Display Chao"]'),
    (v_deal_ana, v_lead_ana, 'CONFIRMADO', 'FRETADA', 'Fundo do Mar', 1200.00, current_date + interval '2 days', 'Av Principal, 400 - Zona Sul', '["Decoração Completa", "Iluminação LED", "Montagem Inclusa"]'),
    (v_deal_pedro, v_lead_pedro, 'CONFIRMADO', 'PEGUE_MONTE', 'Heróis', 300.00, current_date, 'A Combinar (Retirada Loja)', '["Trio de Cilindros", "Bolo Fake", "Bandejas"]')
  ON CONFLICT (id) DO NOTHING;

  -- 7. Inserir Eventos de Teste (Agenda Logística)
  INSERT INTO public.events (deal_id, data_evento, horario, status_operacional, endereco, checklist, pendencia_pagamento) VALUES
    (v_deal_ana, current_date + interval '2 days', '14:00', 'AGUARDANDO', 'Av Principal, 400 - Zona Sul', '{"Montagem do Arco": false, "Conferência Painel": false}', 'Falta Receber 50%'),
    (v_deal_pedro, current_date, '09:00', 'EM_PREPARACAO', 'Retirada na Loja', '{"Kit Completo Separado": true, "Avarias Checadas": false}', NULL)
  ON CONFLICT (deal_id) DO NOTHING;

END $$;

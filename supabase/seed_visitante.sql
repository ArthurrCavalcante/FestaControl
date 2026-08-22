-- Script para popular os dados de demonstração da conta de Visitante (FestaControl Demo)
-- ATENÇÃO: ANTES DE RODAR ESTE SCRIPT, CRIE O USUÁRIO visitante@FestaControl.com NO PAINEL AUTH DO SUPABASE.

-- 1. Garante que a migração da coluna 'checklist' existe na tabela events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '{}'::jsonb;

-- 2. Garante que itens_selecionados existe na tabela deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS itens_selecionados JSONB DEFAULT '[]'::jsonb;

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
  -- Buscar o ID do usuário visitante cadastrado no Auth
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'visitante@FestaControl.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário visitante@FestaControl.com não encontrado. Crie o usuário primeiro no painel Authentication do Supabase.';
  END IF;

  -- Garantir que a empresa Demo existe na tabela de empresas
  INSERT INTO public.companies (id, nome)
  VALUES (v_company_id, 'Visitante (Modo Demonstração)')
  ON CONFLICT (id) DO UPDATE SET nome = 'Visitante (Modo Demonstração)';

  -- Garantir que as configurações da empresa existem
  INSERT INTO public.company_settings (company_id, primary_color)
  VALUES (v_company_id, '#8b5cf6')
  ON CONFLICT (company_id) DO NOTHING;

  -- Vincular o usuário visitante à empresa Demo no novo profiles
  INSERT INTO public.profiles (id, user_id, company_id, role, nome)
  VALUES (v_user_id, v_user_id, v_company_id, 'admin', 'Visitante')
  ON CONFLICT (id) DO UPDATE SET company_id = v_company_id;

  -- Inserir Leads de Teste
  INSERT INTO public.leads (id, company_id, nome, telefone, origem) VALUES
    (v_lead_joao, v_company_id, 'João Silva (Demo)', '11999999999', 'Instagram'),
    (v_lead_maria, v_company_id, 'Maria Souza (Demo)', '11988888888', 'Google'),
    (v_lead_carlos, v_company_id, 'Carlos Oliveira (Demo)', '11977777777', 'Indicação'),
    (v_lead_ana, v_company_id, 'Ana Beatriz (Demo)', '11966666666', 'WhatsApp'),
    (v_lead_pedro, v_company_id, 'Pedro Santos (Demo)', '11955555555', 'Facebook')
  ON CONFLICT (id) DO NOTHING;

  -- Inserir Deals de Teste (Funil de Vendas)
  INSERT INTO public.deals (id, company_id, lead_id, status_funil, modalidade, tema, valor_total, data_festa, endereco, itens_selecionados) VALUES
    (v_deal_joao, v_company_id, v_lead_joao, 'NOVOS', 'PEGUE_MONTE', 'Safari', 350.00, current_date + interval '10 days', 'A Combinar', '["Painel Redondo", "Cilindros", "Personagens M"]'),
    (v_deal_maria, v_company_id, v_lead_maria, 'NEGOCIACAO', 'FRETADA', 'Princesas', 850.00, current_date + interval '15 days', 'Rua das Flores, 123 - Salão', '["Arco de Balões", "Mesa Provençal", "Painel Retangular"]'),
    (v_deal_carlos, v_company_id, v_lead_carlos, 'SINAL', 'PEGUE_MONTE', 'Minecraft', 400.00, current_date + interval '5 days', 'A Combinar', '["Painel Quadrado", "Cilindros M", "Display Chao"]'),
    (v_deal_ana, v_company_id, v_lead_ana, 'CONFIRMADO', 'FRETADA', 'Fundo do Mar', 1200.00, current_date + interval '2 days', 'Av Principal, 400 - Zona Sul', '["Decoração Completa", "Iluminação LED", "Montagem Inclusa"]'),
    (v_deal_pedro, v_company_id, v_lead_pedro, 'CONFIRMADO', 'PEGUE_MONTE', 'Heróis', 300.00, current_date, 'A Combinar (Retirada Loja)', '["Trio de Cilindros", "Bolo Fake", "Bandejas"]')
  ON CONFLICT (id) DO NOTHING;

  -- Inserir Eventos de Teste (Agenda Logística)
  INSERT INTO public.events (deal_id, company_id, data_evento, horario, status_operacional, endereco, checklist, pendencia_pagamento) VALUES
    (v_deal_ana, v_company_id, current_date + interval '2 days', '14:00', 'AGUARDANDO', 'Av Principal, 400 - Zona Sul', '{"Montagem do Arco": false, "Conferência Painel": false}', 'Falta Receber 50%'),
    (v_deal_pedro, v_company_id, current_date, '09:00', 'EM_PREPARACAO', 'Retirada na Loja', '{"Kit Completo Separado": true, "Avarias Checadas": false}', NULL)
  ON CONFLICT (deal_id) DO NOTHING;

END $$;

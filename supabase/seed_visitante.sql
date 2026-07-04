-- Script para criar os dados da empresa Visitante (FestaFlow Demo)
-- ATENÇÃO: ANTES DE RODAR ESTE SCRIPT, FAÇA O LOGIN COM A CONTA DE VISITANTE
-- NO APLICATIVO PARA GERAR O COMPANY_ID. DEPOIS, SUBSTITUA O VALOR NA VARIÁVEL ABAIXO.

-- PASSO 1: Insira o company_id da conta visitante@festaflow.com gerado pelo sistema:
-- Para achar o company_id, veja a tabela `companies` onde o nome seja algo como o email do visitante ou rode:
-- SELECT id FROM companies WHERE id = (SELECT company_id FROM users WHERE email = 'visitante@festaflow.com');

DO $$
DECLARE
  v_company_id UUID := 'INSIRA-O-SEU-COMPANY-ID-AQUI'; -- <<<< TROQUE ISTO
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
  
  -- Atualizar o nome da empresa visitante
  UPDATE companies SET nome = 'Visitante (Modo Demonstração)' WHERE id = v_company_id;

  -- 1. Inserir Leads Falsos
  INSERT INTO leads (id, company_id, nome, telefone, origem) VALUES
    (v_lead_joao, v_company_id, 'João Silva (Demo)', '11999999999', 'Instagram'),
    (v_lead_maria, v_company_id, 'Maria Souza (Demo)', '11988888888', 'Google'),
    (v_lead_carlos, v_company_id, 'Carlos Oliveira (Demo)', '11977777777', 'Indicação'),
    (v_lead_ana, v_company_id, 'Ana Beatriz (Demo)', '11966666666', 'WhatsApp'),
    (v_lead_pedro, v_company_id, 'Pedro Santos (Demo)', '11955555555', 'Facebook');

  -- 2. Inserir Deals Falsos (Espalhados pelo Funil)
  INSERT INTO deals (id, company_id, lead_id, status_funil, modalidade, tema, valor_total, data_festa, endereco, itens_selecionados) VALUES
    (v_deal_joao, v_company_id, v_lead_joao, 'NOVOS', 'PEGUE_MONTE', 'Safari', 350.00, current_date + interval '10 days', 'A Combinar', '["Painel Redondo", "Cilindros", "Personagens M"]'),
    (v_deal_maria, v_company_id, v_lead_maria, 'NEGOCIACAO', 'FRETADA', 'Princesas', 850.00, current_date + interval '15 days', 'Rua das Flores, 123 - Salão', '["Arco de Balões", "Mesa Provençal", "Painel Retangular"]'),
    (v_deal_carlos, v_company_id, v_lead_carlos, 'SINAL', 'PEGUE_MONTE', 'Minecraft', 400.00, current_date + interval '5 days', 'A Combinar', '["Painel Quadrado", "Cilindros M", "Display Chao"]'),
    (v_deal_ana, v_company_id, v_lead_ana, 'CONFIRMADO', 'FRETADA', 'Fundo do Mar', 1200.00, current_date + interval '2 days', 'Av Principal, 400 - Zona Sul', '["Decoração Completa", "Iluminação LED", "Montagem Inclusa"]'),
    (v_deal_pedro, v_company_id, v_lead_pedro, 'CONFIRMADO', 'PEGUE_MONTE', 'Heróis', 300.00, current_date, 'A Combinar (Retirada Loja)', '["Trio de Cilindros", "Bolo Fake", "Bandejas"]');

  -- 3. Inserir Eventos na Agenda Logística (Para os Confirmados)
  INSERT INTO events (id, deal_id, company_id, data_evento, horario, status_operacional, endereco, checklist, pendencia_pagamento) VALUES
    (gen_random_uuid(), v_deal_ana, v_company_id, current_date + interval '2 days', '14:00', 'AGUARDANDO', 'Av Principal, 400 - Zona Sul', '{"Montagem do Arco": false, "Conferência Painel": false}', 'Falta Receber 50%'),
    (gen_random_uuid(), v_deal_pedro, v_company_id, current_date, '09:00', 'EM_PREPARACAO', 'Retirada na Loja', '{"Kit Completo Separado": true, "Avarias Checadas": false}', NULL);

END $$;

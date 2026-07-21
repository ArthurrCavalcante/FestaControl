-- ==============================================================================
-- SCRIPT DE TESTE: CENÁRIOS DE MÍDIA E TEXTO
-- Copie e cole este script no SQL Editor do Supabase e clique em RUN
-- ==============================================================================

DO $$
DECLARE
    v_company_id UUID;
    v_conv_id UUID;
    v_msg_id UUID;
BEGIN
    -- 1. Garantir que pegamos a empresa correta (a que o seu usuário pertence)
    SELECT company_id INTO v_company_id FROM public.profiles LIMIT 1;
    
    IF v_company_id IS NULL THEN
        -- Se por acaso não existir, pega a primeira empresa
        SELECT id INTO v_company_id FROM public.companies LIMIT 1;
    END IF;

    -- ==========================================
    -- CENÁRIO 1: TEXTO SIMPLES
    -- ==========================================
    INSERT INTO public.conversations (company_id, canal, remetente_id, nome_cliente, status, last_message)
    VALUES (v_company_id, 'facebook', 'cliente_teste_1', 'Maria Teste 1', 'OPEN', 'Oi, queria orçamento do Stitch para dia 18.')
    RETURNING id INTO v_conv_id;

    INSERT INTO public.messages (company_id, conversation_id, direction, content, content_type, ai_status)
    VALUES (v_company_id, v_conv_id, 'INBOUND', 'Oi, queria orçamento do Stitch para dia 18.', 'TEXT', 'COMPLETED')
    RETURNING id INTO v_msg_id;

    INSERT INTO public.events_queue (company_id, type, status, payload)
    VALUES (v_company_id, 'MESSAGE_RECEIVED', 'PENDING', 
        jsonb_build_object('conversation_id', v_conv_id, 'message_id', v_msg_id, 'content', 'Oi, queria orçamento do Stitch para dia 18.', 'media_type', 'TEXT')
    );


    -- ==========================================
    -- CENÁRIO 2: ÁUDIO
    -- ==========================================
    INSERT INTO public.conversations (company_id, canal, remetente_id, nome_cliente, status, last_message)
    VALUES (v_company_id, 'facebook', 'cliente_teste_2', 'João Teste 2', 'OPEN', '[Mídia: AUDIO]')
    RETURNING id INTO v_conv_id;

    INSERT INTO public.messages (company_id, conversation_id, direction, content, content_type, media_url, ai_status)
    VALUES (v_company_id, v_conv_id, 'INBOUND', '[Áudio]', 'AUDIO', 'https://www.w3schools.com/html/horse.mp3', 'PENDING')
    RETURNING id INTO v_msg_id;

    INSERT INTO public.events_queue (company_id, type, status, payload)
    VALUES (v_company_id, 'MESSAGE_RECEIVED', 'PENDING', 
        jsonb_build_object('conversation_id', v_conv_id, 'message_id', v_msg_id, 'media_url', 'https://www.w3schools.com/html/horse.mp3', 'media_type', 'AUDIO')
    );


    -- ==========================================
    -- CENÁRIO 3: FOTO
    -- ==========================================
    INSERT INTO public.conversations (company_id, canal, remetente_id, nome_cliente, status, last_message)
    VALUES (v_company_id, 'facebook', 'cliente_teste_3', 'Ana Teste 3', 'OPEN', 'Queria igual essa.')
    RETURNING id INTO v_conv_id;

    INSERT INTO public.messages (company_id, conversation_id, direction, content, content_type, media_url, ai_status)
    VALUES (v_company_id, v_conv_id, 'INBOUND', 'Queria igual essa.', 'IMAGE', 'https://picsum.photos/200/300', 'PENDING')
    RETURNING id INTO v_msg_id;

    INSERT INTO public.events_queue (company_id, type, status, payload)
    VALUES (v_company_id, 'MESSAGE_RECEIVED', 'PENDING', 
        jsonb_build_object('conversation_id', v_conv_id, 'message_id', v_msg_id, 'content', 'Queria igual essa.', 'media_url', 'https://picsum.photos/200/300', 'media_type', 'IMAGE')
    );


    -- ==========================================
    -- CENÁRIO 4: TEXTO CONFUSO
    -- ==========================================
    INSERT INTO public.conversations (company_id, canal, remetente_id, nome_cliente, status, last_message)
    VALUES (v_company_id, 'facebook', 'cliente_teste_4', 'Carlos Teste 4', 'OPEN', 'Oi queria aquele azul que minha prima alugou')
    RETURNING id INTO v_conv_id;

    INSERT INTO public.messages (company_id, conversation_id, direction, content, content_type, ai_status)
    VALUES (v_company_id, v_conv_id, 'INBOUND', 'Oi queria aquele azul que minha prima alugou', 'TEXT', 'COMPLETED')
    RETURNING id INTO v_msg_id;

    INSERT INTO public.events_queue (company_id, type, status, payload)
    VALUES (v_company_id, 'MESSAGE_RECEIVED', 'PENDING', 
        jsonb_build_object('conversation_id', v_conv_id, 'message_id', v_msg_id, 'content', 'Oi queria aquele azul que minha prima alugou', 'media_type', 'TEXT')
    );

END $$;

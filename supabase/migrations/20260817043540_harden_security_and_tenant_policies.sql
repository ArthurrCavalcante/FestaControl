-- FestaFlow — Fase 1: segurança, isolamento de tenant e índices essenciais.
--
-- Esta migration remove políticas legadas permissivas que anulam o isolamento
-- multi-tenant já definido pelas políticas "Isolate tenant ...".

-- 1. Evita que a resolução de objetos SQL dependa do search_path do chamador.
ALTER FUNCTION public.update_modified_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_company_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_same_company(uuid) SET search_path = public, pg_temp;

-- 2. Funções internas não devem ser chamáveis por usuários anônimos via RPC.
-- create_new_tenant continua disponível apenas para usuários autenticados,
-- conforme a migration de onboarding original.
REVOKE EXECUTE ON FUNCTION public.create_new_tenant(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_company_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_same_company(uuid) FROM anon;

-- 3. Remove regras antigas que concedem leitura/escrita sem filtro de empresa.
DROP POLICY IF EXISTS "Permitir leitura/escrita em acervo_composicao" ON public.acervo_composicao;
DROP POLICY IF EXISTS "Auth Logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Auth Logs" ON public.error_logs;
DROP POLICY IF EXISTS "Write Error Logs" ON public.error_logs;
DROP POLICY IF EXISTS "Auth Roles" ON public.user_roles;

-- O SELECT abaixo era redundante: a política ALL possui a mesma restrição.
-- Removê-la elimina uma avaliação duplicada sem alterar a autorização efetiva.
DROP POLICY IF EXISTS "Usuário vê apenas o próprio perfil" ON public.profiles;

-- 4. Índices para as consultas multi-tenant e os joins mais frequentes.
CREATE INDEX IF NOT EXISTS idx_acervo_company_id ON public.acervo(company_id);
CREATE INDEX IF NOT EXISTS idx_acervo_composicao_company_id ON public.acervo_composicao(company_id);
CREATE INDEX IF NOT EXISTS idx_acervo_composicao_tema_id ON public.acervo_composicao(tema_id);
CREATE INDEX IF NOT EXISTS idx_acervo_composicao_peca_id ON public.acervo_composicao(peca_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON public.activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_company_id ON public.automation_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_event_id ON public.automation_runs(event_id);
CREATE INDEX IF NOT EXISTS idx_caixa_entrada_company_id ON public.caixa_entrada(company_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_fotos_company_id ON public.catalogo_fotos(company_id);

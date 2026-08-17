-- PostgreSQL concede EXECUTE a PUBLIC por padrão. A remoção explícita abaixo
-- impede chamadas anônimas via RPC, mantendo somente os acessos autenticados
-- necessários para onboarding, políticas RLS e triggers da aplicação.

REVOKE EXECUTE ON FUNCTION public.create_new_tenant(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_company_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_same_company(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_modified_column() FROM PUBLIC;

-- Fluxos autenticados utilizados pela aplicação.
GRANT EXECUTE ON FUNCTION public.create_new_tenant(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_same_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_modified_column() TO authenticated;

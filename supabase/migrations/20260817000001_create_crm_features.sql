-- =====================================================
-- MIGRATION: CRM Features (Anotações, Arquivos e Bucket)
-- Rode este script no SQL Editor do Supabase Dashboard
-- =====================================================

-- 1. Criar novo Bucket para arquivos do CRM
INSERT INTO storage.buckets (id, name, public) 
VALUES ('crm', 'crm', false) 
ON CONFLICT (id) DO NOTHING;

-- Permitir que usuários autenticados acessem o bucket crm de sua própria empresa
DROP POLICY IF EXISTS "Isolate tenant crm bucket" ON storage.objects;
CREATE POLICY "Isolate tenant crm bucket" 
ON storage.objects FOR ALL TO authenticated 
USING (
  bucket_id = 'crm' AND 
  is_same_company(NULLIF((string_to_array(name, '/'))[1], '')::uuid)
)
WITH CHECK (
  bucket_id = 'crm' AND 
  is_same_company(NULLIF((string_to_array(name, '/'))[1], '')::uuid)
);

-- 2. Tabela de Anotações (deal_notes)
CREATE TABLE IF NOT EXISTS public.deal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    tipo TEXT DEFAULT 'NORMAL',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Arquivos (deal_files)
CREATE TABLE IF NOT EXISTS public.deal_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    nome_arquivo TEXT NOT NULL,
    caminho_storage TEXT NOT NULL,
    tipo TEXT DEFAULT 'Documento',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Aplicar Triggers de company_id
DROP TRIGGER IF EXISTS set_deal_notes_company_id ON public.deal_notes;
CREATE TRIGGER set_deal_notes_company_id BEFORE INSERT ON public.deal_notes FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_deal_files_company_id ON public.deal_files;
CREATE TRIGGER set_deal_files_company_id BEFORE INSERT ON public.deal_files FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

-- 5. Aplicar RLS Multi-tenant
ALTER TABLE public.deal_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolate tenant deal_notes" ON public.deal_notes;
CREATE POLICY "Isolate tenant deal_notes" ON public.deal_notes FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

ALTER TABLE public.deal_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolate tenant deal_files" ON public.deal_files;
CREATE POLICY "Isolate tenant deal_files" ON public.deal_files FOR ALL TO authenticated USING (is_same_company(company_id)) WITH CHECK (is_same_company(company_id));

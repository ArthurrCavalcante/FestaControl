-- =====================================================
-- MIGRATION: Fix Storage Bucket Tenant Isolation
-- Garante que arquivos do bucket 'Catalogo' sejam isolados
-- por empresa. O path de cada arquivo deve começar com
-- o company_id do usuário: {company_id}/filename
-- =====================================================

-- Remove policies abertas anteriores (que checavam só 'authenticated')
DROP POLICY IF EXISTS "Permitir leitura pública do catálogo" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload apenas para autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusão apenas para autenticados" ON storage.objects;

-- Leitura pública continua permitida (necessário para exibir imagens no frontend)
CREATE POLICY "Catalogo: leitura pública"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'Catalogo');

-- Upload restrito à pasta da própria empresa do usuário
-- O path deve ser: {company_id}/{nome_do_arquivo}
CREATE POLICY "Catalogo: upload isolado por empresa"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'Catalogo'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- Atualização restrita à pasta da própria empresa
CREATE POLICY "Catalogo: atualização isolada por empresa"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'Catalogo'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- Exclusão restrita à pasta da própria empresa
CREATE POLICY "Catalogo: exclusão isolada por empresa"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'Catalogo'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

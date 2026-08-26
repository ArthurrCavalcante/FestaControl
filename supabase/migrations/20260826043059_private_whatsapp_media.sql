-- Conversation media shares the private CRM bucket but has its own tenant path.
CREATE POLICY "CRM conversation media select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'crm'
  AND (storage.foldername(name))[1] = 'companies'
  AND (storage.foldername(name))[2] = (
    SELECT profile.company_id::text
    FROM public.profiles profile
    WHERE profile.user_id = (SELECT auth.uid())
  )
  AND (storage.foldername(name))[3] = 'conversations'
  AND EXISTS (
    SELECT 1 FROM public.conversations conversation
    WHERE conversation.id::text = (storage.foldername(name))[4]
      AND conversation.company_id::text = (storage.foldername(name))[2]
  )
);

COMMENT ON COLUMN public.messages.media_url IS
  'Private crm bucket path for tenant media. Legacy HTTPS URLs remain readable during migration.';

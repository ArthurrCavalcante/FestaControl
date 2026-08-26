begin;

create temp table whatsapp_media_test_tenants as
with source_tenant as (
  select
    profile.user_id,
    conversation.company_id,
    conversation.id as conversation_id
  from public.conversations conversation
  join public.profiles profile on profile.company_id = conversation.company_id
  where profile.user_id is not null
  order by conversation.company_id, conversation.created_at
  limit 1
), target_tenant as (
  select profile.user_id, profile.company_id, null::uuid as conversation_id
  from public.profiles profile, source_tenant source
  where profile.user_id is not null
    and profile.company_id is not null
    and profile.company_id <> source.company_id
  order by profile.company_id
  limit 1
)
select 1::bigint as tenant_number, user_id, company_id, conversation_id from source_tenant
union all
select 2::bigint as tenant_number, user_id, company_id, conversation_id from target_tenant;

do $$
begin
  if (select count(distinct company_id) from whatsapp_media_test_tenants) < 2 then
    raise exception 'WhatsApp media RLS test requires two tenants with conversations.';
  end if;
end
$$;

grant select on whatsapp_media_test_tenants to authenticated;
grant select on storage.objects to authenticated;
grant usage on schema auth, storage to authenticated;
grant execute on function auth.uid() to authenticated;

insert into storage.objects (bucket_id, name)
select
  'crm',
  'companies/' || company_id::text || '/conversations/' || conversation_id::text || '/security-test.jpg'
from whatsapp_media_test_tenants
where tenant_number = 1;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from whatsapp_media_test_tenants where tenant_number = 2),
  true
);

do $$
begin
  if (
    select count(*) from storage.objects
    where bucket_id = 'crm'
      and name = (
        select 'companies/' || company_id::text || '/conversations/' || conversation_id::text || '/security-test.jpg'
        from whatsapp_media_test_tenants where tenant_number = 1
      )
  ) <> 0 then
    raise exception 'Tenant B can read tenant A WhatsApp media.';
  end if;
end
$$;

reset role;
rollback;

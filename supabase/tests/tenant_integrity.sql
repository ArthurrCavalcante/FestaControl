begin;

do $$
declare
  healthy_company_id uuid;
  orphan_company_id uuid;
begin
  if to_regprocedure('private.assert_company_has_member(uuid)') is null then
    raise exception 'private.assert_company_has_member(uuid) is missing';
  end if;

  if to_regclass('private.orphan_tenant_audit') is null then
    raise exception 'private.orphan_tenant_audit is missing';
  end if;

  select company_id into healthy_company_id
  from public.profiles
  where company_id is not null
  limit 1;

  if healthy_company_id is null then
    raise exception 'tenant integrity test requires one healthy company';
  end if;

  perform private.assert_company_has_member(healthy_company_id);

  select company_id into orphan_company_id
  from private.orphan_tenant_audit
  limit 1;

  if orphan_company_id is not null then
    begin
      perform private.assert_company_has_member(orphan_company_id);
      raise exception 'legacy orphan was not detected';
    exception
      when check_violation then null;
    end;
  end if;
end
$$;

rollback;

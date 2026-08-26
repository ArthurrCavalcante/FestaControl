begin;

do $$
begin
  if to_regclass('public.whatsapp_automation_deliveries') is null then
    raise exception 'whatsapp_automation_deliveries is missing';
  end if;

  if to_regprocedure('private.claim_whatsapp_automation(uuid,uuid,text,integer)') is null then
    raise exception 'claim_whatsapp_automation is missing';
  end if;

  if to_regprocedure('private.finish_whatsapp_automation(uuid,text,text)') is null then
    raise exception 'finish_whatsapp_automation is missing';
  end if;
end
$$;

rollback;

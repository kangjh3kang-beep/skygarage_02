-- Application workflow automation only. No HTTP requests, device commands or user messages.
create extension if not exists pg_cron with schema pg_catalog;
create function platform_private.governance_maintenance_tick() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q jsonb; s record; r jsonb; stopped integer:=0;
begin
 q:=platform_private.process_foundation_outbox(20);
 for s in select id,phase,validation_scope_id from public.platform_sites where phase in ('site_acceptance','ready') and organization_id is not null for update skip locked loop
  if s.validation_scope_id is null then
   r:=null;
  else
   r:=platform_private.scope_readiness(s.validation_scope_id);
  end if;
  if r is null or r->>'configuration_current' is distinct from 'true' or (r->>'blocking_defects')::integer>0
   or (s.phase='ready' and (r->>'approved')::integer is distinct from 36)
   or (s.phase='site_acceptance' and exists(select 1 from jsonb_array_elements(r->'requirements') x where x->>'id' in ('F01','F02','F03','F04','F05','F06','T01','T02') and x->>'accepted'<>'true')) then
   update public.platform_sites set phase='suspended' where id=s.id;
   insert into platform_private.audit_events(subject_id,action,details) values(s.id,'site.gates_expired',jsonb_build_object('previous_phase',s.phase,'scope_id',s.validation_scope_id));
   stopped:=stopped+1;
  end if;
 end loop;
 return q||jsonb_build_object('sites_suspended',stopped);
end $$;
revoke all on function platform_private.governance_maintenance_tick() from public,anon,authenticated,service_role;
select cron.schedule('doelv-foundation-and-evidence-maintenance','* * * * *','select platform_private.governance_maintenance_tick();');
-- Retain only this application's routine cron history for 30 days; evidence and audit are not deleted.
select cron.schedule('doelv-cron-history-retention','17 3 * * *',
 $$delete from cron.job_run_details where jobid in (select jobid from cron.job where jobname in ('doelv-foundation-and-evidence-maintenance','doelv-cron-history-retention')) and end_time<now()-interval '30 days';$$);

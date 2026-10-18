-- Read-only aggregate for the headquarters commissioning workbench.
-- No site identity, PII, device secret, raw telemetry or actuator permission is returned.
-- Deliberate narrow SECURITY DEFINER: legacy tables remain closed to browsers.
create or replace function public.platform_readiness_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='super_admin')
 then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 select jsonb_build_object(
  'schema_version',1,'observed_at',transaction_timestamp(),
  'counts',jsonb_build_object(
   'sites',(select count(*) from public.platform_sites),
   'blueprints',(select count(*) from public.platform_site_blueprints),
   'memberships',(select count(*) from public.platform_site_members),
   'requests',(select count(*) from public.sgp_service_requests),
   'devices',(select count(*) from public.hardware_device_registry),
   'commands',(select count(*) from public.hardware_commands),
   'telemetry',(select count(*) from public.hardware_telemetry),
   'domain_events',(select count(*) from public.domain_events),
   'ai_models',(select count(*) from public.ai_models),
   'ai_actions',(select count(*) from public.ai_ops_actions),
   'hil_records',(select count(*) from public.hil_test_stages)),
  'security',jsonb_build_object(
   'public_tables_without_rls',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity),
   'legacy_browser_grants',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('hardware_device_registry','hardware_commands','hardware_telemetry','domain_events','ai_models','ai_ops_actions','workflow_executions')
    and (pg_catalog.has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') or pg_catalog.has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
      or pg_catalog.has_table_privilege('anon',c.oid,'DELETE,TRUNCATE,TRIGGER') or pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE,TRUNCATE,TRIGGER'))))) into result;
 return result;
end $$;
revoke all on function public.platform_readiness_snapshot() from public,anon,authenticated;
grant execute on function public.platform_readiness_snapshot() to authenticated;
comment on function public.platform_readiness_snapshot() is 'Super-admin aal2 aggregate only; no commissioning approval or hardware permission.';

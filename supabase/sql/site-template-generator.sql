-- Stage T1: immutable configuration snapshot + atomic sandbox site creation.
-- This API cannot publish a template, grant membership, or enable machinery.
create table public.platform_site_blueprints (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null unique references public.platform_sites(id),
 request_id uuid not null, created_by uuid not null references auth.users(id),
 template_version text not null, definition jsonb not null,
 created_at timestamptz not null default now(), unique(created_by, request_id),
 check (template_version='residence-foundation/1.0.0'),
 check (definition->>'phase'='sandbox'),
 check (definition->'hardware_control_enabled'='false'::jsonb)
);
alter table public.platform_site_blueprints enable row level security;
revoke all on public.platform_site_blueprints from public,anon,authenticated;
grant select on public.platform_site_blueprints to authenticated,service_role;
create policy blueprints_super_admin_mfa on public.platform_site_blueprints for select to authenticated
 using((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='super_admin'));

-- Justification for DEFINER: writes three protected tables in one transaction.
-- Exact database role + MFA checked; only typed parameters, no dynamic SQL.
create or replace function public.platform_generate_site(
 p_request_id uuid,p_name text,p_kind text,p_households integer,p_parking_spaces integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare previous public.platform_site_blueprints%rowtype; definition jsonb; result uuid;
begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='super_admin')
 then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 if p_request_id is null or p_name is null or char_length(btrim(p_name)) not between 2 and 120
 or p_kind is null or p_kind not in ('apartment','officetel','mixed')
 or p_households is null or p_households not between 1 and 10000
 or p_parking_spaces is null or p_parking_spaces not between 0 and 20000
 then raise exception 'invalid_template_input' using errcode='22023'; end if;
 definition:=jsonb_build_object('schema_version',1,'template_version','residence-foundation/1.0.0',
 'name',btrim(p_name),'kind',p_kind,'capacity',jsonb_build_object('households',p_households,'parking_spaces',p_parking_spaces),
 'brand','DOELV','phase','sandbox','membership_approval','manual','hardware_control_enabled',false,
 'payments_enabled',false,'access_grants_enabled',false,'modules',jsonb_build_array('resident_profile','service_requests'),
 'required_gates',jsonb_build_array('tenant_isolation','scoped_roles','membership_approval','device_contract','site_acceptance','recovery_drill'));
 perform pg_advisory_xact_lock(hashtextextended('site-generator:'||auth.uid()::text,0));
 select * into previous from public.platform_site_blueprints where created_by=auth.uid() and request_id=p_request_id;
 if found then
   if previous.definition<>definition then raise exception 'idempotency_conflict' using errcode='22023'; end if;
   return previous.site_id;
 end if;
 if (select count(*) from public.platform_site_blueprints where created_by=auth.uid() and created_at>now()-interval '1 hour')>=20
 then raise exception 'rate_limited'; end if;
 insert into public.platform_sites(name,phase) values(btrim(p_name),'sandbox') returning id into result;
 insert into public.platform_site_blueprints(site_id,request_id,created_by,template_version,definition)
 values(result,p_request_id,auth.uid(),'residence-foundation/1.0.0',definition);
 insert into platform_private.audit_events(actor_id,subject_id,action,details)
 values(auth.uid(),result,'site.sandbox_generated',jsonb_build_object('template_version','residence-foundation/1.0.0','request_id',p_request_id));
 return result;
end $$;
revoke all on function public.platform_generate_site(uuid,text,text,integer,integer) from public,anon;
grant execute on function public.platform_generate_site(uuid,text,text,integer,integer) to authenticated;

-- DOELV governance v1. Additive, non-actuating commissioning control plane.
-- Private tables have no browser grants. Public RPCs enforce live DB roles + aal2.
-- Evidence is an assertion submitted for independent review, not an automated attestation.

create table platform_private.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 2 and 120),
 request_id uuid not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(created_by,request_id)
);
alter table public.platform_sites add column organization_id uuid references platform_private.organizations(id);
create index platform_sites_organization on public.platform_sites(organization_id);
create table platform_private.site_staff (
 site_id uuid not null references public.platform_sites(id), user_id uuid not null references auth.users(id),
 role text not null check(role in ('manager','reviewer','viewer')), active boolean not null default true,
 valid_until timestamptz not null, revision integer not null default 1, primary key(site_id,user_id)
);
create index site_staff_user on platform_private.site_staff(user_id);
create table platform_private.requirement_catalog (
 plan_version text not null, id text not null, phase text not null, title text not null, acceptance text not null,
 dependencies text[] not null, required_kinds text[] not null, primary key(plan_version,id),
 check('acceptance'=any(required_kinds))
);
create table platform_private.validation_scopes (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.platform_sites(id),
 request_id uuid not null, plan_version text not null check(plan_version='2026.10-v1'),
 release_sha text not null check(release_sha ~ '^[0-9a-f]{40}$'),
 configuration_digest text not null check(configuration_digest ~ '^[0-9a-f]{64}$'),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(created_by,request_id), unique(site_id,release_sha,configuration_digest)
);
alter table public.platform_sites add column validation_scope_id uuid references platform_private.validation_scopes(id);
create table platform_private.validation_evidence (
 id uuid primary key default gen_random_uuid(), scope_id uuid not null references platform_private.validation_scopes(id),
 plan_version text not null, requirement_id text not null,
 foreign key(plan_version,requirement_id) references platform_private.requirement_catalog(plan_version,id),
 request_id uuid not null, submitted_by uuid not null references auth.users(id),
 test_kind text not null check(test_kind in ('software','integration','contract','sil','hil','sat','operations','acceptance')),
 environment text not null check(environment in ('simulation','staging','hardware','field')),
 result text not null check(result in ('pass','fail')), procedure_version text not null check(length(btrim(procedure_version)) between 2 and 100),
 artifact_uri text not null check(length(artifact_uri)<=1500 and artifact_uri ~ '^https://[^/@:?# ]+(/[^?# ]*)?$'),
 artifact_sha256 text not null check(artifact_sha256 ~ '^[0-9a-f]{64}$'),
 summary text not null check(length(btrim(summary)) between 5 and 2000),
 measured_at timestamptz not null, expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp(), unique(submitted_by,request_id),
 check(expires_at>measured_at), check(expires_at<=measured_at+interval '366 days'),
 check(test_kind<>'hil' or environment in ('hardware','field')),
 check(test_kind not in ('sat','operations') or environment='field'),
 check(test_kind<>'acceptance' or environment<>'simulation')
);
create index validation_evidence_scope_requirement on platform_private.validation_evidence(scope_id,requirement_id,test_kind,created_at desc);
create table platform_private.evidence_reviews (
 evidence_id uuid primary key references platform_private.validation_evidence(id), reviewer_id uuid not null references auth.users(id),
 decision text not null check(decision in ('approved','rejected')), note text not null check(length(btrim(note)) between 5 and 2000),
 reviewed_at timestamptz not null default clock_timestamp()
);
create table platform_private.improvement_items (
 id uuid primary key default gen_random_uuid(), scope_id uuid not null references platform_private.validation_scopes(id),
 requirement_id text not null, kind text not null check(kind in ('defect','improvement')),
 severity text not null check(severity in ('critical','high','normal')),
 title text not null check(length(btrim(title)) between 5 and 200), description text not null check(length(btrim(description)) between 5 and 2000),
 status text not null default 'open' check(status in ('open','in_progress','verification','closed')),
 source_evidence_id uuid unique references platform_private.validation_evidence(id),
 resolution_evidence_id uuid references platform_private.validation_evidence(id),
 request_id uuid not null, created_by uuid not null references auth.users(id),
 assigned_to uuid references auth.users(id), closed_by uuid references auth.users(id),
 revision integer not null default 1, created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(created_by,request_id)
);
create index improvement_scope_status on platform_private.improvement_items(scope_id,status);
create table platform_private.provisioning_outbox (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.platform_sites(id),
 event_type text not null check(event_type='site.foundation.created'), schema_version integer not null default 1 check(schema_version=1),
 correlation_id uuid not null, payload_digest text not null, status text not null default 'pending' check(status in ('pending','processed','dead_letter')),
 attempts integer not null default 0, available_at timestamptz not null default now(), created_at timestamptz not null default now(),
 processed_at timestamptz, last_error text, unique(site_id,event_type)
);
create index provisioning_outbox_due on platform_private.provisioning_outbox(available_at) where status='pending';
create table platform_private.provisioning_inbox (
 event_id uuid primary key references platform_private.provisioning_outbox(id), payload_digest text not null, processed_at timestamptz not null default now()
);
create table platform_private.site_modules (
 site_id uuid not null references public.platform_sites(id), module text not null, state text not null check(state='configured'),
 source_event_id uuid not null references platform_private.provisioning_outbox(id), primary key(site_id,module),
 check(module in ('resident_profile','service_requests'))
);

-- Definer helper is intentionally not executable by client roles.
create function platform_private.is_headquarters() returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal'='aal2',false)
 and exists(select 1 from public.user_roles where user_id=auth.uid() and role='super_admin');
$$;
create function platform_private.assert_site_access(p_site_id uuid,p_write boolean default false,p_review boolean default false)
returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
 if not exists(select 1 from public.platform_sites where id=p_site_id and organization_id is not null) then raise exception 'site_unavailable' using errcode='42501'; end if;
 if platform_private.is_headquarters() then return; end if;
 if not exists(select 1 from platform_private.site_staff s join public.user_roles r on r.user_id=s.user_id
  where s.site_id=p_site_id and s.user_id=auth.uid() and s.active and s.valid_until>statement_timestamp()
  and r.role in ('admin','manager','operator','viewer')
  and (not p_write or s.role='manager') and (not p_review or s.role='reviewer'))
 then raise exception 'site_access_denied' using errcode='42501'; end if;
end $$;
create function platform_private.site_digest(p_site_id uuid) returns text language sql stable security invoker set search_path='' as $$
 select encode(extensions.digest(b.definition::text,'sha256'),'hex') from public.platform_site_blueprints b where b.site_id=p_site_id;
$$;
create function platform_private.assert_scope(p_scope_id uuid,p_write boolean default false,p_review boolean default false)
returns platform_private.validation_scopes language plpgsql stable security invoker set search_path='' as $$
declare s platform_private.validation_scopes;
begin
 select * into s from platform_private.validation_scopes where id=p_scope_id;
 perform platform_private.assert_site_access(s.site_id,p_write,p_review);
 if s.configuration_digest is distinct from platform_private.site_digest(s.site_id) then raise exception 'configuration_changed'; end if;
 return s;
end $$;

create function public.platform_create_organization(p_request_id uuid,p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous platform_private.organizations; result uuid;
begin
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 if p_request_id is null or p_name is null or length(btrim(p_name)) not between 2 and 120 then raise exception 'invalid_input' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('organization:'||auth.uid()::text,0));
 select * into previous from platform_private.organizations where created_by=auth.uid() and request_id=p_request_id;
 if found then
  if previous.name<>btrim(p_name) then raise exception 'idempotency_conflict'; end if;
  return previous.id;
 end if;
 if (select count(*) from platform_private.organizations where created_by=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'rate_limited'; end if;
 insert into platform_private.organizations(name,request_id,created_by) values(btrim(p_name),p_request_id,auth.uid()) returning id into result;
 insert into platform_private.audit_events(actor_id,subject_id,action) values(auth.uid(),result,'organization.created');
 return result;
end $$;

create function public.platform_generate_site_v2(p_request_id uuid,p_organization_id uuid,p_name text,p_kind text,p_households integer,p_parking_spaces integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare site uuid; org uuid;
begin
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 if not exists(select 1 from platform_private.organizations where id=p_organization_id) then raise exception 'organization_required'; end if;
 -- Existing generator retains input validation, throttling and stable request identity.
 site:=public.platform_generate_site(p_request_id,p_name,p_kind,p_households,p_parking_spaces);
 select organization_id into org from public.platform_sites where id=site for update;
 if org is not null and org<>p_organization_id then raise exception 'idempotency_conflict'; end if;
 update public.platform_sites set organization_id=p_organization_id where id=site and organization_id is null;
 insert into platform_private.provisioning_outbox(site_id,event_type,correlation_id,payload_digest)
 values(site,'site.foundation.created',p_request_id,platform_private.site_digest(site)) on conflict(site_id,event_type) do nothing;
 return site;
end $$;

create function public.platform_set_site_staff(p_site_id uuid,p_user_id uuid,p_role text,p_active boolean,p_valid_until timestamptz,p_expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare previous platform_private.site_staff; result integer;
begin
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 perform platform_private.assert_site_access(p_site_id);
 if p_user_id is null or p_role is null or p_role not in ('manager','reviewer','viewer') or p_active is null
 or p_valid_until is null or p_valid_until<=now() or p_valid_until>now()+interval '366 days'
 or not exists(select 1 from public.user_roles where user_id=p_user_id and role in ('admin','manager','operator','viewer','super_admin'))
 then raise exception 'invalid_staff_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended('staff:'||p_site_id::text||p_user_id::text,0));
 select * into previous from platform_private.site_staff where site_id=p_site_id and user_id=p_user_id;
 if coalesce(previous.revision,0) is distinct from p_expected_revision then raise exception 'version_conflict'; end if;
 result:=coalesce(previous.revision,0)+1;
 insert into platform_private.site_staff(site_id,user_id,role,active,valid_until,revision) values(p_site_id,p_user_id,p_role,p_active,p_valid_until,result)
 on conflict(site_id,user_id) do update set role=excluded.role,active=excluded.active,valid_until=excluded.valid_until,revision=excluded.revision;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),p_site_id,'site.staff_changed',jsonb_build_object('user_id',p_user_id,'role',p_role,'active',p_active,'revision',result));
 return result;
end $$;

create function public.platform_open_validation_scope(p_request_id uuid,p_site_id uuid,p_release_sha text)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous platform_private.validation_scopes; result uuid; digest text;
begin
 perform platform_private.assert_site_access(p_site_id,true);
 if p_request_id is null or p_release_sha is null or p_release_sha !~ '^[0-9a-f]{40}$' then raise exception 'invalid_scope_input'; end if;
 select id into result from public.platform_sites where id=p_site_id for update;
 digest:=platform_private.site_digest(p_site_id);
 if digest is null then raise exception 'blueprint_required'; end if;
 select * into previous from platform_private.validation_scopes where created_by=auth.uid() and request_id=p_request_id;
 if found then
  if previous.site_id<>p_site_id or previous.release_sha<>p_release_sha or previous.configuration_digest<>digest then raise exception 'idempotency_conflict'; end if;
  return previous.id;
 end if;
 select id into result from platform_private.validation_scopes where site_id=p_site_id and release_sha=p_release_sha and configuration_digest=digest;
 if result is null then
  insert into platform_private.validation_scopes(site_id,request_id,plan_version,release_sha,configuration_digest,created_by)
  values(p_site_id,p_request_id,'2026.10-v1',p_release_sha,digest,auth.uid()) returning id into result;
 end if;
 -- Selecting another release never carries operational readiness forward.
 update public.platform_sites set validation_scope_id=result,phase=case when phase='suspended' then phase else 'sandbox' end where id=p_site_id;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),p_site_id,'validation.scope_selected',jsonb_build_object('scope_id',result,'release_sha',p_release_sha));
 return result;
end $$;

create function public.platform_submit_evidence(p_scope_id uuid,p_request_id uuid,p_requirement_id text,p_test_kind text,p_environment text,p_result text,
 p_procedure_version text,p_artifact_uri text,p_artifact_sha256 text,p_summary text,p_measured_at timestamptz,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare s platform_private.validation_scopes; previous platform_private.validation_evidence; result uuid;
begin
 s:=platform_private.assert_scope(p_scope_id,true);
 if p_request_id is null or p_measured_at is null or p_measured_at>clock_timestamp()+interval '5 minutes' or p_expires_at is null or p_expires_at<=clock_timestamp()
 then raise exception 'invalid_evidence_time'; end if;
 perform pg_advisory_xact_lock(hashtextextended('evidence:'||auth.uid()::text||p_request_id::text,0));
 select * into previous from platform_private.validation_evidence where submitted_by=auth.uid() and request_id=p_request_id;
 if found then
  if row(previous.scope_id,previous.requirement_id,previous.test_kind,previous.environment,previous.result,previous.procedure_version,previous.artifact_uri,previous.artifact_sha256,previous.summary,previous.measured_at,previous.expires_at)
   is distinct from row(p_scope_id,p_requirement_id,p_test_kind,p_environment,p_result,btrim(p_procedure_version),p_artifact_uri,p_artifact_sha256,btrim(p_summary),p_measured_at,p_expires_at)
  then raise exception 'idempotency_conflict'; end if;
  return previous.id;
 end if;
 if (select count(*) from platform_private.validation_evidence where submitted_by=auth.uid() and created_at>now()-interval '1 hour')>=200 then raise exception 'rate_limited'; end if;
 insert into platform_private.validation_evidence(scope_id,plan_version,requirement_id,request_id,submitted_by,test_kind,environment,result,procedure_version,artifact_uri,artifact_sha256,summary,measured_at,expires_at)
 values(p_scope_id,s.plan_version,p_requirement_id,p_request_id,auth.uid(),p_test_kind,p_environment,p_result,btrim(p_procedure_version),p_artifact_uri,p_artifact_sha256,btrim(p_summary),p_measured_at,p_expires_at) returning id into result;
 if p_result='fail' then
  insert into platform_private.improvement_items(scope_id,requirement_id,kind,severity,title,description,source_evidence_id,request_id,created_by)
  values(p_scope_id,p_requirement_id,'defect','high',p_requirement_id||' 재검증 필요',btrim(p_summary),result,p_request_id,auth.uid());
  update public.platform_sites set phase='suspended' where id=s.site_id and validation_scope_id=p_scope_id and phase in ('ready','site_acceptance');
 end if;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),result,'evidence.submitted',jsonb_build_object('scope_id',p_scope_id,'requirement_id',p_requirement_id,'result',p_result));
 return result;
end $$;

create function public.platform_review_evidence(p_evidence_id uuid,p_decision text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare e platform_private.validation_evidence; previous platform_private.evidence_reviews;
begin
 select * into e from platform_private.validation_evidence where id=p_evidence_id for update;
 perform platform_private.assert_scope(e.scope_id,false,true);
 if e.submitted_by=auth.uid() then raise exception 'independent_reviewer_required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') or p_note is null or length(btrim(p_note)) not between 5 and 2000 then raise exception 'review_note_required'; end if;
 select * into previous from platform_private.evidence_reviews where evidence_id=p_evidence_id;
 if found then
  if previous.reviewer_id=auth.uid() and previous.decision=p_decision and previous.note=btrim(p_note) then return; end if;
  raise exception 'review_immutable';
 end if;
 if p_decision='approved' and (e.result<>'pass' or e.expires_at<=clock_timestamp()) then raise exception 'passing_current_evidence_required'; end if;
 insert into platform_private.evidence_reviews(evidence_id,reviewer_id,decision,note) values(p_evidence_id,auth.uid(),p_decision,btrim(p_note));
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),p_evidence_id,'evidence.reviewed',jsonb_build_object('decision',p_decision));
end $$;

create function public.platform_create_improvement(p_scope_id uuid,p_request_id uuid,p_requirement_id text,p_kind text,p_severity text,p_title text,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s platform_private.validation_scopes; previous platform_private.improvement_items; result uuid;
begin
 s:=platform_private.assert_scope(p_scope_id,true);
 if p_request_id is null or not exists(select 1 from platform_private.requirement_catalog where plan_version=s.plan_version and id=p_requirement_id) then raise exception 'requirement_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('improvement:'||auth.uid()::text||p_request_id::text,0));
 select * into previous from platform_private.improvement_items where created_by=auth.uid() and request_id=p_request_id;
 if found then
  if row(previous.scope_id,previous.requirement_id,previous.kind,previous.severity,previous.title,previous.description)
   is distinct from row(p_scope_id,p_requirement_id,p_kind,p_severity,btrim(p_title),btrim(p_description)) then raise exception 'idempotency_conflict'; end if;
  return previous.id;
 end if;
 if (select count(*) from platform_private.improvement_items where created_by=auth.uid() and created_at>now()-interval '1 hour')>=100 then raise exception 'rate_limited'; end if;
 insert into platform_private.improvement_items(scope_id,requirement_id,kind,severity,title,description,request_id,created_by)
 values(p_scope_id,p_requirement_id,p_kind,p_severity,btrim(p_title),btrim(p_description),p_request_id,auth.uid()) returning id into result;
 if p_kind='defect' and p_severity in ('critical','high') then
  update public.platform_sites set phase='suspended' where id=s.site_id and validation_scope_id=p_scope_id and phase in ('ready','site_acceptance');
 end if;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),result,'improvement.created',jsonb_build_object('scope_id',p_scope_id,'kind',p_kind));
 return result;
end $$;

create function public.platform_transition_improvement(p_id uuid,p_expected_revision integer,p_status text,p_evidence_id uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare i platform_private.improvement_items; e platform_private.validation_evidence;
begin
 select * into i from platform_private.improvement_items where id=p_id for update;
 perform platform_private.assert_scope(i.scope_id,p_status<>'closed',p_status='closed');
 if i.revision is distinct from p_expected_revision then raise exception 'version_conflict'; end if;
 if p_status is null or not ((i.status='open' and p_status='in_progress') or (i.status='in_progress' and p_status='verification') or (i.status='verification' and p_status in ('in_progress','closed')))
 then raise exception 'invalid_transition'; end if;
 if p_status='verification' then
  select * into e from platform_private.validation_evidence where id=p_evidence_id;
  if e.id is null or e.scope_id<>i.scope_id or e.requirement_id<>i.requirement_id or e.result<>'pass' or e.expires_at<=now() or e.created_at<=i.created_at
  then raise exception 'new_passing_evidence_required'; end if;
  if i.source_evidence_id is not null and not exists(select 1 from platform_private.validation_evidence f where f.id=i.source_evidence_id and f.test_kind=e.test_kind and f.environment=e.environment and e.measured_at>f.measured_at)
  then raise exception 'matching_retest_required'; end if;
 end if;
 if p_status='closed' then
  if auth.uid() in (i.created_by,i.assigned_to) then raise exception 'independent_reviewer_required' using errcode='42501'; end if;
  if not exists(select 1 from platform_private.validation_evidence v join platform_private.evidence_reviews r on r.evidence_id=v.id
   where v.id=i.resolution_evidence_id and v.result='pass' and v.expires_at>now() and r.decision='approved' and r.reviewer_id<>v.submitted_by)
  then raise exception 'reviewed_retest_required'; end if;
 end if;
 update platform_private.improvement_items set status=p_status,revision=revision+1,updated_at=clock_timestamp(),
  assigned_to=case when p_status='in_progress' then auth.uid() else assigned_to end,
  resolution_evidence_id=case when p_status='verification' then p_evidence_id when p_status='in_progress' then null else resolution_evidence_id end,
  closed_by=case when p_status='closed' then auth.uid() else null end where id=p_id;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),p_id,'improvement.transitioned',jsonb_build_object('status',p_status,'revision',i.revision+1));
 return i.revision+1;
end $$;

-- Every requirement needs an independently approved acceptance checklist AND its test kinds.
-- Missing dependencies, unresolved defects, expiry, newer failure or changed configuration block it.
create function platform_private.scope_readiness(p_scope_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare s platform_private.validation_scopes; accepted text[]:='{}'; covered text[]:='{}'; r record; pass integer; changed boolean; result jsonb;
begin
 select * into s from platform_private.validation_scopes where id=p_scope_id;
 if s.id is null then raise exception 'scope_required'; end if;
 if (select count(*) from platform_private.requirement_catalog where plan_version=s.plan_version)<>36 then raise exception 'catalog_incomplete'; end if;
 for r in select * from platform_private.requirement_catalog where plan_version=s.plan_version loop
  if s.configuration_digest=platform_private.site_digest(s.site_id)
  and not exists(select 1 from platform_private.improvement_items i where i.scope_id=s.id and i.requirement_id=r.id and i.kind='defect' and i.status<>'closed')
  and not exists(select 1 from unnest(r.required_kinds) k where not exists(
    select 1 from platform_private.validation_evidence e join platform_private.evidence_reviews v on v.evidence_id=e.id
    where e.scope_id=s.id and e.requirement_id=r.id and e.test_kind=k and e.result='pass' and e.expires_at>statement_timestamp()
     and v.decision='approved' and v.reviewer_id<>e.submitted_by
     and (exists(select 1 from public.user_roles u where u.user_id=v.reviewer_id and u.role='super_admin')
      or exists(select 1 from platform_private.site_staff st join public.user_roles u on u.user_id=st.user_id where st.site_id=s.site_id and st.user_id=v.reviewer_id and st.active and st.role='reviewer' and st.valid_until>statement_timestamp() and u.role in ('admin','manager','operator','viewer')))
     and not exists(select 1 from platform_private.validation_evidence f where f.scope_id=e.scope_id and f.requirement_id=e.requirement_id and f.test_kind=e.test_kind and f.result='fail' and f.created_at>=e.created_at)
  )) then covered:=array_append(covered,r.id); end if;
 end loop;
 for pass in 1..36 loop
  changed:=false;
  for r in select * from platform_private.requirement_catalog where plan_version=s.plan_version and id=any(covered) loop
   if not r.id=any(accepted) and r.dependencies<@accepted then accepted:=array_append(accepted,r.id);changed:=true;end if;
  end loop;
  exit when not changed;
 end loop;
 select jsonb_build_object('approved',cardinality(accepted),'total',count(*),'covered',cardinality(covered),
  'requirements',jsonb_agg(jsonb_build_object('id',c.id,'phase',c.phase,'title',c.title,'required_kinds',c.required_kinds,
   'evidence_complete',c.id=any(covered),'accepted',c.id=any(accepted),'dependencies',c.dependencies) order by c.phase,c.id),
  'blocking_defects',(select count(*) from platform_private.improvement_items i where i.scope_id=s.id and i.kind='defect' and i.status<>'closed'),
  'configuration_current',s.configuration_digest=platform_private.site_digest(s.site_id)) into result
 from platform_private.requirement_catalog c where c.plan_version=s.plan_version;
 return result;
end $$;

create function public.platform_governance_directory() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
 select jsonb_build_object('schema_version',1,'observed_at',statement_timestamp(),'headquarters',platform_private.is_headquarters(),
 'operators',case when platform_private.is_headquarters() then coalesce((select jsonb_agg(jsonb_build_object('id',u.user_id,'name',case when btrim(u.display_name)='' then '관리자 '||left(u.user_id::text,8) else u.display_name end) order by u.display_name) from public.user_roles u where u.role in ('admin','manager','operator','viewer','super_admin')),'[]'::jsonb) else '[]'::jsonb end,
 'assignments',case when platform_private.is_headquarters() then coalesce((select jsonb_agg(to_jsonb(st)) from platform_private.site_staff st),'[]'::jsonb) else '[]'::jsonb end,
 'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name) from platform_private.organizations o
  where platform_private.is_headquarters() or exists(select 1 from public.platform_sites s join platform_private.site_staff st on st.site_id=s.id join public.user_roles u on u.user_id=st.user_id
  where s.organization_id=o.id and st.user_id=auth.uid() and st.active and st.valid_until>statement_timestamp() and u.role in ('admin','manager','operator','viewer'))),'[]'::jsonb),
 'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'phase',s.phase,'organization_id',s.organization_id,'validation_scope_id',s.validation_scope_id) order by s.created_at desc)
  from public.platform_sites s where s.organization_id is not null and (platform_private.is_headquarters() or exists(select 1 from platform_private.site_staff st join public.user_roles u on u.user_id=st.user_id
   where st.site_id=s.id and st.user_id=auth.uid() and st.active and st.valid_until>statement_timestamp() and u.role in ('admin','manager','operator','viewer')))),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.platform_governance_snapshot(p_scope_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s platform_private.validation_scopes; result jsonb;
begin
 s:=platform_private.assert_scope(p_scope_id);
 select jsonb_build_object('schema_version',1,'observed_at',statement_timestamp(),'scope',to_jsonb(s),
 'permissions',jsonb_build_object('write',platform_private.is_headquarters() or exists(select 1 from platform_private.site_staff where site_id=s.site_id and user_id=auth.uid() and active and valid_until>now() and role='manager'),
  'review',platform_private.is_headquarters() or exists(select 1 from platform_private.site_staff where site_id=s.site_id and user_id=auth.uid() and active and valid_until>now() and role='reviewer')),
 'readiness',platform_private.scope_readiness(s.id),
 'evidence_total',(select count(*) from platform_private.validation_evidence where scope_id=s.id),
 'evidence',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('review',to_jsonb(v)) order by e.created_at desc) from
  (select * from platform_private.validation_evidence where scope_id=s.id order by created_at desc limit 100) e left join platform_private.evidence_reviews v on v.evidence_id=e.id),'[]'::jsonb),
 'improvements_total',(select count(*) from platform_private.improvement_items where scope_id=s.id),
 'improvements',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from
  (select * from platform_private.improvement_items where scope_id=s.id order by (status='closed'),created_at desc limit 100) i),'[]'::jsonb),
 'provisioning',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'status',q.status,'attempts',q.attempts,'last_error',q.last_error,'created_at',q.created_at,'processed_at',q.processed_at)) from platform_private.provisioning_outbox q where q.site_id=s.site_id),'[]'::jsonb),
 'modules',coalesce((select jsonb_agg(jsonb_build_object('module',m.module,'state',m.state)) from platform_private.site_modules m where m.site_id=s.site_id),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.platform_set_site_phase(p_site_id uuid,p_scope_id uuid,p_expected_phase text,p_phase text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare s public.platform_sites; readiness jsonb;
begin
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 select * into s from public.platform_sites where id=p_site_id for update;
 perform platform_private.assert_site_access(p_site_id);
 if s.phase is distinct from p_expected_phase or s.validation_scope_id is distinct from p_scope_id then raise exception 'version_conflict'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 5 and 2000 then raise exception 'reason_required'; end if;
 if p_phase is null or not (p_phase='suspended' or (s.phase='suspended' and p_phase='sandbox') or (s.phase='sandbox' and p_phase='site_acceptance') or (s.phase='site_acceptance' and p_phase='ready')) then raise exception 'invalid_transition'; end if;
 if p_phase in ('site_acceptance','ready') then
  perform platform_private.assert_scope(p_scope_id);
  readiness:=platform_private.scope_readiness(p_scope_id);
  if (readiness->>'blocking_defects')::integer>0 then raise exception 'open_defects'; end if;
  if not exists(select 1 from platform_private.provisioning_outbox where site_id=p_site_id and status='processed') then raise exception 'provisioning_incomplete'; end if;
  if p_phase='site_acceptance' and exists(select 1 from jsonb_array_elements(readiness->'requirements') r where r->>'id' in ('F01','F02','F03','F04','F05','F06','T01','T02') and r->>'accepted'<>'true') then raise exception 'foundation_gates_missing'; end if;
  if p_phase='ready' and (readiness->>'approved')::integer is distinct from 36 then raise exception 'acceptance_gates_missing'; end if;
 end if;
 update public.platform_sites set phase=p_phase where id=p_site_id;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),p_site_id,'site.phase_changed',jsonb_build_object('from',s.phase,'to',p_phase,'scope_id',p_scope_id,'reason',btrim(p_reason)));
end $$;

-- Internal DB-only consumer. No network, device control, access right or payment effects.
-- SKIP LOCKED + transactional inbox allows parallel callers and safe crash rollback.
create function platform_private.process_foundation_outbox(p_limit integer default 20) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q record; digest text; v_module text; done integer:=0; failed integer:=0;
begin
 for q in select * from platform_private.provisioning_outbox where status='pending' and available_at<=now() order by created_at for update skip locked limit greatest(1,least(coalesce(p_limit,20),50)) loop
  begin
   if exists(select 1 from public.platform_sites where id=q.site_id and phase='suspended') then continue; end if;
   digest:=platform_private.site_digest(q.site_id);
   if digest is distinct from q.payload_digest then raise exception 'configuration_digest_mismatch'; end if;
   if exists(select 1 from platform_private.provisioning_inbox where event_id=q.id and payload_digest<>q.payload_digest) then raise exception 'inbox_digest_conflict'; end if;
   if not exists(select 1 from platform_private.provisioning_inbox where event_id=q.id) then
    for v_module in select jsonb_array_elements_text(definition->'modules') from public.platform_site_blueprints where site_id=q.site_id loop
     insert into platform_private.site_modules(site_id,module,state,source_event_id) values(q.site_id,v_module,'configured',q.id) on conflict(site_id,module) do nothing;
    end loop;
    insert into platform_private.provisioning_inbox(event_id,payload_digest) values(q.id,q.payload_digest);
   end if;
   update platform_private.provisioning_outbox set status='processed',attempts=attempts+1,processed_at=clock_timestamp(),last_error=null where id=q.id;
   done:=done+1;
  exception when others then
   update platform_private.provisioning_outbox set attempts=attempts+1,status=case when attempts+1>=5 then 'dead_letter' else 'pending' end,
    available_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,q.attempts)::integer)),last_error='configuration_processing_failed' where id=q.id;
   failed:=failed+1;
  end;
 end loop;
 return jsonb_build_object('processed',done,'failed',failed);
end $$;
create function public.platform_process_foundation_queue() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 return platform_private.process_foundation_outbox(20);
end $$;

-- Lock down every newly introduced table/function, including default grants in existing projects.
do $$
declare n text;
begin
 foreach n in array array['organizations','site_staff','requirement_catalog','validation_scopes','validation_evidence','evidence_reviews','improvement_items','provisioning_outbox','provisioning_inbox','site_modules'] loop
  execute format('alter table platform_private.%I enable row level security',n);
  execute format('revoke all on platform_private.%I from public,anon,authenticated,service_role',n);
 end loop;
end $$;
do $$
declare p record;
begin
 for p in select proc.oid::regprocedure as signature from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='platform_private' and proc.proname in ('is_headquarters','assert_site_access','site_digest','assert_scope','scope_readiness','process_foundation_outbox') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',p.signature);
 end loop;
end $$;
do $$
declare p record;
begin
 for p in select proc.oid::regprocedure as signature from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace
  where n.nspname='public' and proc.proname in ('platform_create_organization','platform_generate_site_v2','platform_set_site_staff','platform_open_validation_scope','platform_submit_evidence','platform_review_evidence','platform_create_improvement','platform_transition_improvement','platform_governance_directory','platform_governance_snapshot','platform_set_site_phase','platform_process_foundation_queue') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',p.signature);
  execute format('grant execute on function %s to authenticated',p.signature);
 end loop;
end $$;

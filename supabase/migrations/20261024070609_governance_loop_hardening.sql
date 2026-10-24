-- Additive governance hardening. No hardware, payment or autonomous model execution.
create function platform_private.assert_governance_session() returns void
language plpgsql security invoker set search_path='' as $$
declare sid text:=auth.jwt()->>'session_id'; live uuid;
begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
 if sid is null or sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'reauthentication_required' using errcode='42501'; end if;
 select s.id into live from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=sid::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>clock_timestamp())
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share of s;
 if live is null then raise exception 'reauthentication_required' using errcode='42501'; end if;
end $$;

create function platform_private.current_site_reviewer(person uuid,site uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.user_roles r join auth.users u on u.id=r.user_id
 where r.user_id=person and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp())
 and (r.role='super_admin' or (r.role in ('admin','manager','operator','viewer') and exists(
 select 1 from platform_private.site_staff st where st.site_id=site and st.user_id=person
 and st.active and st.valid_until>statement_timestamp() and st.role='reviewer'))));
$$;

create function platform_private.current_evidence(evidence uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from platform_private.validation_evidence e
 join platform_private.validation_scopes s on s.id=e.scope_id
 join platform_private.evidence_reviews r on r.evidence_id=e.id
 where e.id=evidence and e.result='pass' and e.measured_at<=statement_timestamp() and e.expires_at>statement_timestamp()
 and r.decision='approved' and r.reviewer_id<>e.submitted_by and platform_private.current_site_reviewer(r.reviewer_id,s.site_id)
 and not exists(select 1 from platform_private.validation_evidence f
 where f.scope_id=e.scope_id and f.requirement_id=e.requirement_id and f.test_kind=e.test_kind
 and f.result='fail' and f.created_at>=e.created_at));
$$;
revoke all on function platform_private.assert_governance_session(),platform_private.current_site_reviewer(uuid,uuid),platform_private.current_evidence(uuid) from public,anon,authenticated,service_role;

create table platform_private.governance_commands (
 actor_id uuid not null references auth.users(id),request_id uuid not null,
 payload_digest text not null,result integer not null,created_at timestamptz not null default now(),
 primary key(actor_id,request_id)
);
alter table platform_private.governance_commands enable row level security;
revoke all on platform_private.governance_commands from public,anon,authenticated,service_role;
create index governance_evidence_cursor on platform_private.validation_evidence(scope_id,created_at desc,id desc);
create index governance_improvement_cursor on platform_private.improvement_items(scope_id,created_at desc,id desc);


create or replace function public.platform_create_organization(p_request_id uuid,p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous platform_private.organizations; result uuid;
begin
 perform platform_private.assert_governance_session();
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

create or replace function public.platform_generate_site_v2(p_request_id uuid,p_organization_id uuid,p_name text,p_kind text,p_households integer,p_parking_spaces integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare site uuid; org uuid;
begin
 perform platform_private.assert_governance_session();
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

create or replace function public.platform_set_site_staff(p_site_id uuid,p_user_id uuid,p_role text,p_active boolean,p_valid_until timestamptz,p_expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare previous platform_private.site_staff; result integer;
begin
 perform platform_private.assert_governance_session();
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 perform platform_private.assert_site_access(p_site_id);
 if p_user_id is null or p_role is null or p_role not in ('manager','reviewer','viewer') or p_active is null
 or p_valid_until is null or p_valid_until<=now() or p_valid_until>now()+interval '366 days'
 or not exists(select 1 from public.user_roles r join auth.users u on u.id=r.user_id where r.user_id=p_user_id and r.role in ('admin','manager','operator','viewer','super_admin') and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp()))
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

create or replace function public.platform_open_validation_scope(p_request_id uuid,p_site_id uuid,p_release_sha text)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous platform_private.validation_scopes; result uuid; digest text;
begin
 perform platform_private.assert_governance_session();
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

create or replace function public.platform_submit_evidence(p_scope_id uuid,p_request_id uuid,p_requirement_id text,p_test_kind text,p_environment text,p_result text,
 p_procedure_version text,p_artifact_uri text,p_artifact_sha256 text,p_summary text,p_measured_at timestamptz,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare s platform_private.validation_scopes; previous platform_private.validation_evidence; result uuid;
begin
 perform platform_private.assert_governance_session();
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

create or replace function public.platform_review_evidence(p_evidence_id uuid,p_decision text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare e platform_private.validation_evidence; previous platform_private.evidence_reviews;
begin
 perform platform_private.assert_governance_session();
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

create or replace function public.platform_create_improvement(p_scope_id uuid,p_request_id uuid,p_requirement_id text,p_kind text,p_severity text,p_title text,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s platform_private.validation_scopes; previous platform_private.improvement_items; result uuid;
begin
 perform platform_private.assert_governance_session();
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

create or replace function public.platform_transition_improvement(p_id uuid,p_expected_revision integer,p_status text,p_evidence_id uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare i platform_private.improvement_items; e platform_private.validation_evidence;
begin
 perform platform_private.assert_governance_session();
 select * into i from platform_private.improvement_items where id=p_id for update;
 perform platform_private.assert_scope(i.scope_id,p_status<>'closed',p_status='closed');
 if i.revision is distinct from p_expected_revision then raise exception 'version_conflict'; end if;
 if p_status is null or not ((i.status='open' and p_status='in_progress') or (i.status='in_progress' and p_status='verification') or (i.status='verification' and p_status in ('in_progress','closed')))
 then raise exception 'invalid_transition'; end if;
 if p_status='verification' then
  select * into e from platform_private.validation_evidence where id=p_evidence_id;
  if e.id is null or e.scope_id<>i.scope_id or e.requirement_id<>i.requirement_id or e.result<>'pass' or e.expires_at<=now() or e.created_at<=i.created_at or e.measured_at<i.created_at or e.measured_at>now()
   or exists(select 1 from platform_private.evidence_reviews r where r.evidence_id=e.id and r.decision='rejected')
  then raise exception 'new_passing_evidence_required'; end if;
  if i.source_evidence_id is not null and not exists(select 1 from platform_private.validation_evidence f where f.id=i.source_evidence_id and f.test_kind=e.test_kind and f.environment=e.environment and e.measured_at>f.measured_at)
  then raise exception 'matching_retest_required'; end if;
 end if;
 if p_status='closed' then
  if auth.uid() in (i.created_by,i.assigned_to) then raise exception 'independent_reviewer_required' using errcode='42501'; end if;
  if not exists(select 1 from platform_private.validation_evidence v join platform_private.evidence_reviews r on r.evidence_id=v.id
   where v.id=i.resolution_evidence_id and v.result='pass' and v.expires_at>now() and r.decision='approved' and r.reviewer_id<>v.submitted_by and r.reviewer_id<>i.created_by
   and r.reviewer_id is distinct from i.assigned_to and v.submitted_by<>auth.uid()
   and platform_private.current_evidence(v.id))
  then raise exception 'reviewed_retest_required'; end if;
 end if;
 update platform_private.improvement_items set status=p_status,revision=revision+1,updated_at=clock_timestamp(),
  assigned_to=case when p_status='in_progress' then auth.uid() else assigned_to end,
  resolution_evidence_id=case when p_status='verification' then p_evidence_id when p_status='in_progress' then null else resolution_evidence_id end,
  closed_by=case when p_status='closed' then auth.uid() else null end where id=p_id;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),p_id,'improvement.transitioned',jsonb_build_object('status',p_status,'revision',i.revision+1));
 return i.revision+1;
end $$;

create or replace function public.platform_governance_directory() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform platform_private.assert_governance_session();
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

create or replace function public.platform_governance_snapshot(p_scope_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s platform_private.validation_scopes; result jsonb;
begin
 perform platform_private.assert_governance_session();
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

create or replace function public.platform_set_site_phase(p_site_id uuid,p_scope_id uuid,p_expected_phase text,p_phase text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare s public.platform_sites; readiness jsonb;
begin
 perform platform_private.assert_governance_session();
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

create or replace function public.platform_process_foundation_queue() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform platform_private.assert_governance_session();
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 return platform_private.process_foundation_outbox(20);
end $$;

create or replace function platform_private.scope_readiness(p_scope_id uuid) returns jsonb
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
     and platform_private.current_evidence(e.id)
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

-- A lost response can be retried with the same request UUID, even after revision changed.
create function public.platform_transition_improvement_v2(p_request_id uuid,p_id uuid,p_expected_revision integer,p_status text,p_evidence_id uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare item platform_private.improvement_items; receipt platform_private.governance_commands; digest text; result integer;
begin
 perform platform_private.assert_governance_session();
 select * into item from platform_private.improvement_items where id=p_id;
 perform platform_private.assert_scope(item.scope_id,p_status<>'closed',p_status='closed');
 if p_request_id is null then raise exception 'request_id_required'; end if;
 digest:=encode(extensions.digest(jsonb_build_array(p_id,p_expected_revision,p_status,p_evidence_id)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('governance:'||auth.uid()::text||p_request_id::text,0));
 select * into receipt from platform_private.governance_commands where actor_id=auth.uid() and request_id=p_request_id;
 if found then
  if receipt.payload_digest<>digest then raise exception 'idempotency_conflict'; end if;
  return receipt.result;
 end if;
 result:=public.platform_transition_improvement(p_id,p_expected_revision,p_status,p_evidence_id);
 insert into platform_private.governance_commands(actor_id,request_id,payload_digest,result) values(auth.uid(),p_request_id,digest,result);
 return result;
end $$;

create function public.platform_growth_loop_snapshot(p_scope_id uuid,p_requirement_id text default null,p_status text default 'active',p_evidence_state text default 'all',p_query text default '',p_improvement_before uuid default null,p_evidence_before uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s platform_private.validation_scopes; ic platform_private.improvement_items; ec platform_private.validation_evidence;
 items jsonb; proofs jsonb; next_i uuid; next_e uuid; total_i bigint; total_e bigint; readiness jsonb; blockers jsonb;
begin
 perform platform_private.assert_governance_session();s:=platform_private.assert_scope(p_scope_id);
 if p_status is null or p_status not in ('all','active','open','in_progress','verification','closed')
 or p_evidence_state is null or p_evidence_state not in ('all','pending','expiring','expired','fail')
 or p_query is null or length(p_query)>100 or (p_requirement_id is not null and not exists(select 1 from platform_private.requirement_catalog where plan_version=s.plan_version and id=p_requirement_id))
 then raise exception 'invalid_loop_filter'; end if;
 if p_improvement_before is not null then
  select * into ic from platform_private.improvement_items where id=p_improvement_before and scope_id=s.id;
  if not found then raise exception 'invalid_loop_cursor'; end if;
 end if;
 if p_evidence_before is not null then
  select * into ec from platform_private.validation_evidence where id=p_evidence_before and scope_id=s.id;
  if not found then raise exception 'invalid_loop_cursor'; end if;
 end if;
 with filtered as (
  select * from platform_private.improvement_items i where scope_id=s.id
  and (p_requirement_id is null or requirement_id=p_requirement_id)
  and (p_status='all' or (p_status='active' and status<>'closed') or status=p_status)
  and (p_query='' or strpos(lower(title||' '||description),lower(p_query))>0)
 ), page as (
  select * from filtered where p_improvement_before is null or (created_at,id)<(ic.created_at,ic.id)
  order by created_at desc,id desc limit 26
 )
 select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from (select * from page order by created_at desc,id desc limit 25)x),'[]'::jsonb),
  case when (select count(*) from page)>25 then (select id from page order by created_at desc,id desc offset 24 limit 1) end
 into total_i,items,next_i;
 with filtered as (
  select e.*,to_jsonb(r) as review from platform_private.validation_evidence e left join platform_private.evidence_reviews r on r.evidence_id=e.id
  where e.scope_id=s.id and (p_requirement_id is null or e.requirement_id=p_requirement_id)
  and (p_query='' or strpos(lower(e.summary||' '||e.procedure_version),lower(p_query))>0)
  and (p_evidence_state='all' or (p_evidence_state='pending' and r.evidence_id is null and e.expires_at>statement_timestamp())
   or (p_evidence_state='expired' and e.expires_at<=statement_timestamp()) or (p_evidence_state='fail' and e.result='fail')
   or (p_evidence_state='expiring' and platform_private.current_evidence(e.id) and e.expires_at<=statement_timestamp()+interval '7 days'))
 ), page as (
  select * from filtered where p_evidence_before is null or (created_at,id)<(ec.created_at,ec.id)
  order by created_at desc,id desc limit 26
 )
 select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from (select * from page order by created_at desc,id desc limit 25)x),'[]'::jsonb),
  case when (select count(*) from page)>25 then (select id from page order by created_at desc,id desc offset 24 limit 1) end
 into total_e,proofs,next_e;
 readiness:=platform_private.scope_readiness(s.id);
 select jsonb_agg(jsonb_build_object('id',c.id,'missing_kinds',coalesce((select jsonb_agg(k) from unnest(c.required_kinds)k
  where not exists(select 1 from platform_private.validation_evidence e where e.scope_id=s.id and e.requirement_id=c.id and e.test_kind=k and platform_private.current_evidence(e.id))),'[]'::jsonb),
  'open_defects',(select count(*) from platform_private.improvement_items i where i.scope_id=s.id and i.requirement_id=c.id and i.kind='defect' and i.status<>'closed')) order by c.phase,c.id)
 into blockers from platform_private.requirement_catalog c where c.plan_version=s.plan_version;
 return public.platform_governance_snapshot(p_scope_id) || jsonb_build_object('observed_at',statement_timestamp(),
  'readiness',readiness,'blockers',blockers,
  'counts',jsonb_build_object(
   'active',(select count(*) from platform_private.improvement_items where scope_id=s.id and status<>'closed'),
   'critical',(select count(*) from platform_private.improvement_items where scope_id=s.id and status<>'closed' and severity='critical'),
   'unassigned',(select count(*) from platform_private.improvement_items where scope_id=s.id and status<>'closed' and assigned_to is null),
   'verification',(select count(*) from platform_private.improvement_items where scope_id=s.id and status='verification'),
   'closed',(select count(*) from platform_private.improvement_items where scope_id=s.id and status='closed'),
   'pending_reviews',(select count(*) from platform_private.validation_evidence e where scope_id=s.id and expires_at>statement_timestamp() and not exists(select 1 from platform_private.evidence_reviews where evidence_id=e.id)),
   'expired',(select count(*) from platform_private.validation_evidence where scope_id=s.id and expires_at<=statement_timestamp()),
   'expiring',(select count(*) from platform_private.validation_evidence e where scope_id=s.id and expires_at<=statement_timestamp()+interval '7 days' and platform_private.current_evidence(e.id))),
  'improvements',items,'evidence',proofs,'improvements_total',total_i,'evidence_total',total_e,'next_improvement',next_i,'next_evidence',next_e);
end $$;

-- Exact requirement/scope/time matching; query old evidence without a latest-100 limit.
create function public.platform_retest_candidates(p_id uuid,p_before uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i platform_private.improvement_items; cursor_row platform_private.validation_evidence; rows jsonb; next_id uuid;
begin
 perform platform_private.assert_governance_session();
 select * into i from platform_private.improvement_items where id=p_id;
 perform platform_private.assert_scope(i.scope_id,true);
 if i.status<>'in_progress' then raise exception 'invalid_transition'; end if;
 if p_before is not null then
  select * into cursor_row from platform_private.validation_evidence where id=p_before and scope_id=i.scope_id and requirement_id=i.requirement_id;
  if not found then raise exception 'invalid_loop_cursor'; end if;
 end if;
 with page as (
  select e.* from platform_private.validation_evidence e where e.scope_id=i.scope_id and e.requirement_id=i.requirement_id
  and e.result='pass' and e.expires_at>statement_timestamp() and e.created_at>i.created_at and e.measured_at>=i.created_at and e.measured_at<=statement_timestamp()
  and not exists(select 1 from platform_private.evidence_reviews r where r.evidence_id=e.id and r.decision='rejected')
  and (i.source_evidence_id is null or exists(select 1 from platform_private.validation_evidence f where f.id=i.source_evidence_id and f.test_kind=e.test_kind and f.environment=e.environment and e.measured_at>f.measured_at))
  and (p_before is null or (e.created_at,e.id)<(cursor_row.created_at,cursor_row.id))
  order by e.created_at desc,e.id desc limit 26
 ) select coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from (select * from page order by created_at desc,id desc limit 25)x),'[]'::jsonb),
 case when (select count(*) from page)>25 then (select id from page order by created_at desc,id desc offset 24 limit 1) end into rows,next_id;
 return jsonb_build_object('schema_version',1,'item_id',i.id,'scope_id',i.scope_id,'evidence',rows,'next',next_id);
end $$;
revoke all on function public.platform_transition_improvement_v2(uuid,uuid,integer,text,uuid),public.platform_growth_loop_snapshot(uuid,text,text,text,text,uuid,uuid),public.platform_retest_candidates(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.platform_transition_improvement_v2(uuid,uuid,integer,text,uuid),public.platform_growth_loop_snapshot(uuid,text,text,text,text,uuid,uuid),public.platform_retest_candidates(uuid,uuid) to authenticated;

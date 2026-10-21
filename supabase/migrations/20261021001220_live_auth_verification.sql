-- AAL2 headquarters initiates isolated, automated hosted-Auth tests.
-- Secrets remain in the Edge invocation. These reports cannot grant acceptance.
create table platform_private.live_auth_runs (
 id uuid primary key, created_by uuid not null references auth.users(id),
 release_sha text not null check(release_sha ~ '^[a-f0-9]{40}$'),
 site_a uuid not null references public.platform_sites(id), site_b uuid not null references public.platform_sites(id),
 scope_a uuid not null references platform_private.validation_scopes(id), scope_b uuid not null references platform_private.validation_scopes(id),
 status text not null default 'running' check(status in ('running','passed','failed','expired')),
 actors jsonb not null default '{}'::jsonb, checks jsonb not null default '[]'::jsonb,
 error_code text, database_cleanup boolean not null default false, auth_cleanup boolean not null default false,
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',
 finished_at timestamptz
);
alter table platform_private.live_auth_runs enable row level security;
revoke all on platform_private.live_auth_runs from public,anon,authenticated,service_role;
create index live_auth_runs_owner_created on platform_private.live_auth_runs(created_by,created_at);

create function platform_private.live_auth_summary(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('schema_version',1,'id',id,'release_sha',release_sha,'status',status,
 'site_a',site_a,'site_b',site_b,'scope_a',scope_a,'scope_b',scope_b,'checks',checks,'error_code',error_code,
 'database_cleanup',database_cleanup,'auth_cleanup',auth_cleanup,'created_at',created_at,'finished_at',finished_at,
 'test_accounts',(select count(*) from jsonb_object_keys(actors)),'environment','staging','kind','live_auth_automated',
 'acceptance_granted',false,'human_reviewed',false,'hardware_verified',false)
 from platform_private.live_auth_runs where id=p_id;
$$;

create function platform_private.reap_live_auth_runs() returns integer
language plpgsql security definer set search_path='' as $$
declare r platform_private.live_auth_runs; n integer:=0;
begin
 for r in select * from platform_private.live_auth_runs where status='running' and expires_at<=clock_timestamp() for update skip locked loop
  update platform_private.site_staff set active=false,revision=revision+1 where user_id in (select value::text::uuid from jsonb_each_text(r.actors));
  update public.platform_site_members set status='revoked' where user_id in (select value::text::uuid from jsonb_each_text(r.actors));
  delete from public.user_roles where user_id in (select value::text::uuid from jsonb_each_text(r.actors));
  update platform_private.live_auth_runs set status='expired',database_cleanup=true,error_code='execution_expired',finished_at=clock_timestamp() where id=r.id;
  n:=n+1;
 end loop;
 return n;
end $$;

create function public.platform_begin_live_auth_test(p_request_id uuid,p_release_sha text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r platform_private.live_auth_runs; oa uuid; ob uuid; a uuid; b uuid; sa uuid; sb uuid; label text;
begin
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 if p_request_id is null or p_release_sha is null or p_release_sha !~ '^[a-f0-9]{40}$' then raise exception 'invalid_test_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('live-auth:'||auth.uid()::text,0));
 perform platform_private.reap_live_auth_runs();
 select * into r from platform_private.live_auth_runs where id=p_request_id;
 if found then
  if r.created_by<>auth.uid() or r.release_sha<>p_release_sha then raise exception 'idempotency_conflict'; end if;
  return platform_private.live_auth_summary(r.id)||jsonb_build_object('claimed',false);
 end if;
 if exists(select 1 from platform_private.live_auth_runs where created_by=auth.uid() and status='running') then raise exception 'test_already_running'; end if;
 if (select count(*) from platform_private.live_auth_runs where created_by=auth.uid() and created_at>now()-interval '1 hour')>=3 then raise exception 'rate_limited'; end if;
 label:='[G0 TEST] '||left(p_request_id::text,8);
 oa:=public.platform_create_organization(gen_random_uuid(),label||' 조직 A');
 ob:=public.platform_create_organization(gen_random_uuid(),label||' 조직 B');
 a:=public.platform_generate_site_v2(gen_random_uuid(),oa,label||' 현장 A','apartment',2,4);
 b:=public.platform_generate_site_v2(gen_random_uuid(),ob,label||' 현장 B','apartment',2,4);
 sa:=public.platform_open_validation_scope(gen_random_uuid(),a,p_release_sha);
 sb:=public.platform_open_validation_scope(gen_random_uuid(),b,p_release_sha);
 insert into platform_private.live_auth_runs(id,created_by,release_sha,site_a,site_b,scope_a,scope_b)
 values(p_request_id,auth.uid(),p_release_sha,a,b,sa,sb);
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),p_request_id,'verification.live_auth_started',jsonb_build_object('release_sha',p_release_sha));
 return platform_private.live_auth_summary(p_request_id)||jsonb_build_object('claimed',true);
end $$;

-- Only the server may bind newly created test identities. No arbitrary users,
-- existing roles, headquarters privileges, real sites or client-supplied expiry.
create function public.platform_bind_live_auth_actor(p_run_id uuid,p_user_id uuid,p_slot text) returns void
language plpgsql security definer set search_path='' as $$
declare r platform_private.live_auth_runs; u auth.users;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'service_required' using errcode='42501'; end if;
 select * into r from platform_private.live_auth_runs where id=p_run_id for update;
 if r.id is null or r.status<>'running' or r.expires_at<=clock_timestamp() then raise exception 'test_not_running'; end if;
 if p_slot is null or p_slot not in ('writer','reviewer','member') or r.actors ? p_slot then raise exception 'invalid_test_actor'; end if;
 select * into u from auth.users where id=p_user_id;
 if u.id is null or u.raw_app_meta_data->>'skygarage_test_run' is distinct from p_run_id::text
  or u.email is distinct from ('g0-'||replace(p_run_id::text,'-','')||'-'||p_slot||'@example.invalid')
  or u.created_at<r.created_at or exists(select 1 from public.user_roles where user_id=p_user_id)
  or exists(select 1 from platform_private.site_staff where user_id=p_user_id)
 then raise exception 'invalid_test_actor'; end if;
 if p_slot<>'member' then
  insert into public.user_roles(user_id,role,display_name) values(p_user_id,case when p_slot='writer' then 'operator' else 'viewer' end,'[G0 TEST] '||p_slot);
  insert into platform_private.site_staff(site_id,user_id,role,valid_until) values(r.site_a,p_user_id,case when p_slot='writer' then 'manager' else 'reviewer' end,r.expires_at);
 else
  insert into public.platform_site_members(site_id,user_id,status,unit_label) values(r.site_a,p_user_id,'active','G0 TEST');
 end if;
 update platform_private.live_auth_runs set actors=actors||jsonb_build_object(p_slot,p_user_id) where id=p_run_id;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(r.created_by,p_user_id,'verification.test_actor_bound',jsonb_build_object('run_id',p_run_id,'slot',p_slot));
end $$;

create function public.platform_finish_live_auth_test(p_run_id uuid,p_checks jsonb,p_error_code text,p_auth_cleanup boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r platform_private.live_auth_runs;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'service_required' using errcode='42501'; end if;
 select * into r from platform_private.live_auth_runs where id=p_run_id for update;
 if r.id is null then raise exception 'test_not_found'; end if;
 if r.status<>'running' then return platform_private.live_auth_summary(r.id); end if;
 if p_checks is null or jsonb_typeof(p_checks)<>'array' or jsonb_array_length(p_checks)>60
 or exists(select 1 from jsonb_array_elements(p_checks) c where jsonb_typeof(c)<>'object' or jsonb_typeof(c->'passed') is distinct from 'boolean' or c->>'id' is null or c->>'id' !~ '^[a-z0-9_]{2,80}$' or (c-'id'-'passed')<>'{}'::jsonb)
 or (p_error_code is not null and p_error_code not in ('execution_failed','assertion_failed','auth_cleanup_failed'))
 or p_auth_cleanup is null then raise exception 'invalid_test_report'; end if;
 update platform_private.site_staff set active=false,revision=revision+1 where user_id in (select value::text::uuid from jsonb_each_text(r.actors));
 update public.platform_site_members set status='revoked' where user_id in (select value::text::uuid from jsonb_each_text(r.actors));
 delete from public.user_roles where user_id in (select value::text::uuid from jsonb_each_text(r.actors));
 update platform_private.live_auth_runs set checks=p_checks,error_code=p_error_code,database_cleanup=true,auth_cleanup=p_auth_cleanup,finished_at=clock_timestamp(),
 status=case when p_error_code is null and p_auth_cleanup and jsonb_array_length(p_checks)>=15 and (select count(*) from jsonb_object_keys(actors))=3 and not exists(select 1 from jsonb_array_elements(p_checks) c where c->>'passed'<>'true') then 'passed' else 'failed' end where id=p_run_id;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(r.created_by,p_run_id,'verification.live_auth_finished',jsonb_build_object('checks',jsonb_array_length(p_checks),'auth_cleanup',p_auth_cleanup,'acceptance_granted',false));
 return platform_private.live_auth_summary(p_run_id);
end $$;

create function public.platform_live_auth_report(p_run_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare id uuid;
begin
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 select r.id into id from platform_private.live_auth_runs r where r.created_by=auth.uid() and (p_run_id is null or r.id=p_run_id) order by r.created_at desc limit 1;
 return platform_private.live_auth_summary(id);
end $$;

revoke all on function platform_private.live_auth_summary(uuid),platform_private.reap_live_auth_runs() from public,anon,authenticated,service_role;
revoke all on function public.platform_begin_live_auth_test(uuid,text),public.platform_live_auth_report(uuid),public.platform_bind_live_auth_actor(uuid,uuid,text),public.platform_finish_live_auth_test(uuid,jsonb,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.platform_begin_live_auth_test(uuid,text),public.platform_live_auth_report(uuid) to authenticated;
grant execute on function public.platform_bind_live_auth_actor(uuid,uuid,text),public.platform_finish_live_auth_test(uuid,jsonb,text,boolean) to service_role;

-- Hosted pg_cron reaps an interrupted invocation; local contract DBs omit cron.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('platform-live-auth-cleanup','*/5 * * * *','select platform_private.reap_live_auth_runs()');
 end if;
end $$;

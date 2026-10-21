-- Verify hosted Auth state, rather than treating SDK logout success as proof.
create function platform_private.live_auth_cleanup_ok(p_run_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select not exists (
  select 1 from auth.users u where u.raw_app_meta_data->>'skygarage_test_run'=p_run_id::text
  and (u.banned_until is null or u.banned_until<=now()
   or exists(select 1 from auth.sessions s where s.user_id=u.id)
   or exists(select 1 from auth.refresh_tokens t where t.user_id=u.id::text and t.revoked is not true))
 );
$$;

create function platform_private.enforce_live_auth_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.auth_cleanup and not platform_private.live_auth_cleanup_ok(new.id) then
  new.auth_cleanup:=false;
  new.status:='failed';
  new.error_code:='auth_cleanup_failed';
 end if;
 return new;
end $$;
create trigger verify_hosted_auth_cleanup before update on platform_private.live_auth_runs
for each row execute function platform_private.enforce_live_auth_cleanup();

-- Only HQ + actual AAL2 may request recovery of their completed test runs.
-- There must be no platform role, active staff assignment or membership.
create function public.platform_live_auth_cleanup_targets() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('run_id',r.id,'user_id',u.id,'email',u.email))
 from platform_private.live_auth_runs r join auth.users u on u.raw_app_meta_data->>'skygarage_test_run'=r.id::text
 where r.created_by=auth.uid() and r.status in ('failed','expired')
 and u.created_at>=r.created_at
 and u.email in ('g0-'||replace(r.id::text,'-','')||'-writer@example.invalid','g0-'||replace(r.id::text,'-','')||'-reviewer@example.invalid','g0-'||replace(r.id::text,'-','')||'-member@example.invalid')
 and not exists(select 1 from public.user_roles x where x.user_id=u.id)
 and not exists(select 1 from platform_private.site_staff x where x.user_id=u.id and x.active)
 and not exists(select 1 from public.platform_site_members x where x.user_id=u.id and x.status='active')
 and (u.banned_until is null or u.banned_until<=now()
  or exists(select 1 from auth.sessions s where s.user_id=u.id)
  or exists(select 1 from auth.refresh_tokens t where t.user_id=u.id::text and t.revoked is not true))), '[]'::jsonb);
end $$;

create function public.platform_verify_live_auth_cleanup(p_run_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r platform_private.live_auth_runs; clean boolean;
begin
 if not platform_private.is_headquarters() then raise exception 'super_admin_mfa_required' using errcode='42501'; end if;
 select * into r from platform_private.live_auth_runs where id=p_run_id and created_by=auth.uid() for update;
 if r.id is null or r.status not in ('failed','expired') then raise exception 'cleanup_run_unavailable'; end if;
 clean:=platform_private.live_auth_cleanup_ok(r.id);
 update platform_private.live_auth_runs set auth_cleanup=clean where id=r.id;
 insert into platform_private.audit_events(actor_id,subject_id,action,details)
 values(auth.uid(),r.id,'verification.auth_cleanup_rechecked',jsonb_build_object('confirmed',clean,'original_result_preserved',true));
 return clean;
end $$;

revoke all on function platform_private.live_auth_cleanup_ok(uuid),platform_private.enforce_live_auth_cleanup() from public,anon,authenticated,service_role;
revoke all on function public.platform_live_auth_cleanup_targets(),public.platform_verify_live_auth_cleanup(uuid) from public,anon,authenticated,service_role;
grant execute on function public.platform_live_auth_cleanup_targets(),public.platform_verify_live_auth_cleanup(uuid) to authenticated;

-- Correct earlier cleanup claims without rewriting the individual check results.
with corrected as (
 update platform_private.live_auth_runs set auth_cleanup=false,status='failed',error_code='auth_cleanup_failed'
 where status='passed' and auth_cleanup and not platform_private.live_auth_cleanup_ok(id)
 returning id,created_by
)
insert into platform_private.audit_events(actor_id,subject_id,action,details)
select created_by,id,'verification.auth_cleanup_claim_corrected',jsonb_build_object('reason','hosted_auth_state_not_clean') from corrected;

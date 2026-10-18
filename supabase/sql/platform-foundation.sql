-- Platform foundation: no device commands, payment rights or tenant-wide public grants.
create schema if not exists platform_private;
revoke all on schema platform_private from public, anon, authenticated;
grant usage on schema platform_private to service_role;

create table if not exists public.platform_sites (
 id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 2 and 120),
 phase text not null default 'draft' check (phase in ('draft','contracting','sandbox','site_acceptance','ready','suspended')),
 created_at timestamptz not null default now()
);
create table if not exists public.platform_site_members (
 site_id uuid not null references public.platform_sites(id), user_id uuid not null references auth.users(id),
 unit_label text not null default '' check (char_length(unit_label)<=80),
 status text not null default 'pending' check (status in ('pending','active','revoked')),
 primary key(site_id,user_id)
);
create table if not exists public.platform_resident_vehicles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 site_id uuid not null, plate text not null check (char_length(plate) between 4 and 20),
 model text not null check (char_length(model) between 1 and 80),
 status text not null default 'pending' check (status in ('pending','verified','revoked')),
 foreign key(site_id,user_id) references public.platform_site_members(site_id,user_id), unique(site_id,plate)
);
create table if not exists public.sgp_service_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 client_request_id uuid not null,
 category text not null check (category in ('residence','vehicle','visit','concierge')),
 subject text not null check(char_length(btrim(subject)) between 2 and 80),
 description text not null check(char_length(btrim(description)) between 5 and 2000),
 status text not null default 'submitted' check(status in ('submitted','reviewing','resolved','rejected')),
 response text check(char_length(response)<=2000), created_at timestamptz not null default now(),
 reviewed_at timestamptz, reviewed_by uuid references auth.users(id), unique(user_id,client_request_id)
);
create index if not exists sgp_service_requests_owner_created on public.sgp_service_requests(user_id,created_at desc);
create index if not exists platform_site_members_owner on public.platform_site_members(user_id);
create index if not exists platform_resident_vehicles_owner on public.platform_resident_vehicles(user_id);
create table if not exists platform_private.audit_events (
 id bigint generated always as identity primary key, actor_id uuid, subject_id uuid,
 action text not null, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.platform_sites enable row level security;
alter table public.platform_site_members enable row level security;
alter table public.platform_resident_vehicles enable row level security;
alter table public.sgp_service_requests enable row level security;
alter table platform_private.audit_events enable row level security;
revoke all on public.platform_sites,public.platform_site_members,public.platform_resident_vehicles,public.sgp_service_requests from public,anon,authenticated;
revoke all on platform_private.audit_events from public,anon,authenticated,service_role;
grant select on platform_private.audit_events to service_role;
grant all on public.platform_sites,public.platform_site_members,public.platform_resident_vehicles,public.sgp_service_requests to service_role;
grant select on public.platform_sites,public.platform_site_members,public.platform_resident_vehicles,public.sgp_service_requests to authenticated;
grant insert(user_id,client_request_id,category,subject,description) on public.sgp_service_requests to authenticated;
grant update(status,response) on public.sgp_service_requests to authenticated;

create policy platform_members_own_or_mfa_admin on public.platform_site_members for select to authenticated
 using(user_id=(select auth.uid()) or ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='super_admin')));
create policy platform_sites_member_or_mfa_admin on public.platform_sites for select to authenticated
 using(exists(select 1 from public.platform_site_members m where m.site_id=id and m.user_id=(select auth.uid()) and m.status='active') or ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='super_admin')));
create policy platform_vehicles_own_or_mfa_admin on public.platform_resident_vehicles for select to authenticated
 using(user_id=(select auth.uid()) or ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='super_admin')));
create policy service_requests_own_or_mfa_admin on public.sgp_service_requests for select to authenticated
 using(user_id=(select auth.uid()) or ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='super_admin')));
create policy service_requests_verified_owner on public.sgp_service_requests for insert to authenticated
 with check(user_id=(select auth.uid()) and status='submitted' and response is null and reviewed_at is null and reviewed_by is null and exists(select 1 from public.sgp_users where id=(select auth.uid()) and is_verified and status='active'));
create policy service_requests_mfa_admin_review on public.sgp_service_requests for update to authenticated
 using((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='super_admin'))
 with check((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='super_admin'));

create or replace function platform_private.guard_service_request() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('postgres','service_role') then return new; end if;
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if tg_op='INSERT' then
  if new.user_id<>auth.uid() then raise exception 'owner_mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if (select count(*) from public.sgp_service_requests where user_id=auth.uid() and created_at>now()-interval '5 minutes')>=5 then raise exception 'rate_limited'; end if;
  if new.status<>'submitted' or new.response is not null or new.reviewed_by is not null then raise exception 'invalid_initial_state'; end if;
 else
  if auth.jwt()->>'aal' is distinct from 'aal2' or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='super_admin') then raise exception 'admin_mfa_required'; end if;
  if old.status in ('resolved','rejected') then raise exception 'request_closed'; end if;
  if new.status not in ('reviewing','resolved','rejected') then raise exception 'invalid_transition'; end if;
  if new.status in ('resolved','rejected') and char_length(btrim(coalesce(new.response,'')))<2 then raise exception 'response_required'; end if;
  new.reviewed_at:=now(); new.reviewed_by:=auth.uid();
 end if;
 return new;
end $$;
create trigger service_request_guard before insert or update on public.sgp_service_requests for each row execute function platform_private.guard_service_request();

-- The private trigger is the sole application audit writer. No browser INSERT grant.
-- SECURITY DEFINER is confined to append-only audit insertion after RLS and the guard pass.
create or replace function platform_private.audit_service_request() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'audit_actor_required'; end if;
 if tg_op='INSERT' and new.user_id<>auth.uid() then raise exception 'audit_owner_mismatch'; end if;
 if tg_op='UPDATE' and (auth.jwt()->>'aal' is distinct from 'aal2' or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='super_admin')) then raise exception 'audit_admin_required'; end if;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),new.id,case when tg_op='INSERT' then 'request.submitted' else 'request.reviewed' end,jsonb_build_object('status',new.status));
 return new;
end $$;
create trigger service_request_audit after insert or update on public.sgp_service_requests for each row execute function platform_private.audit_service_request();
revoke all on function platform_private.guard_service_request(), platform_private.audit_service_request() from public,anon,authenticated;

create or replace function public.sgp_submit_service_request(p_client_request_id uuid,p_category text,p_subject text,p_description text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare existing public.sgp_service_requests%rowtype; result uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into existing from public.sgp_service_requests where user_id=auth.uid() and client_request_id=p_client_request_id;
 if found then
  if existing.category<>p_category or existing.subject<>btrim(p_subject) or existing.description<>btrim(p_description) then raise exception 'idempotency_conflict'; end if;
  return existing.id;
 end if;
 insert into public.sgp_service_requests(user_id,client_request_id,category,subject,description)
 values(auth.uid(),p_client_request_id,p_category,btrim(p_subject),btrim(p_description)) returning id into result;
 return result;
end $$;
revoke all on function public.sgp_submit_service_request(uuid,text,text,text) from public,anon;
grant execute on function public.sgp_submit_service_request(uuid,text,text,text) to authenticated;

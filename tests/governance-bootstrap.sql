-- LOCAL DISPOSABLE DATABASE ONLY. Minimal Supabase prerequisites for SQL contracts.
-- Auth JWT verification and the hosted Data API are NOT emulated by this fixture.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key default gen_random_uuid());
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;
create table public.user_roles(id uuid primary key default gen_random_uuid(),user_id uuid unique not null references auth.users(id),role text not null default 'operator',display_name text not null default '',created_at timestamptz not null default now());
alter table public.user_roles enable row level security;
grant select on public.user_roles to authenticated;
create policy own_role on public.user_roles for select to authenticated using(user_id=auth.uid());
create table public.sgp_users(id uuid primary key references auth.users(id),is_verified boolean not null default false,status text not null default 'active');
alter table public.sgp_users enable row level security;
grant select on public.sgp_users to authenticated;
create policy own_profile on public.sgp_users for select to authenticated using(id=auth.uid());

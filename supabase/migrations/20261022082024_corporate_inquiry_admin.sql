-- WEB-01 admin v1. Apply after the original inquiries/user_roles schema.
-- Public submission consent/idempotency and actual delivery are separate stages.
begin;
create schema if not exists platform_private;
revoke all on schema platform_private from public,anon;
grant usage on schema platform_private to authenticated;
alter table public.inquiries
 add column revision integer not null default 1 check(revision>0),
 add column assigned_to uuid references auth.users(id),
 add column reply_saved_at timestamptz,
 add column delivery_status text not null default 'not_sent' check(delivery_status in ('not_sent','legacy_unknown'));
update public.inquiries set delivery_status='legacy_unknown' where reply_content is not null or replied_at is not null;

create table platform_private.inquiry_commands (
 actor_id uuid not null references auth.users(id), request_id uuid not null,
 action text not null, payload_digest text not null, result jsonb not null,
 created_at timestamptz not null default clock_timestamp(), primary key(actor_id,request_id)
);
create table platform_private.inquiry_events (
 id bigint generated always as identity primary key, inquiry_id text not null references public.inquiries(id),
 actor_id uuid not null references auth.users(id), action text not null, data jsonb not null,
 revision integer not null, created_at timestamptz not null default clock_timestamp(), unique(inquiry_id,revision)
);
create index inquiry_events_page on platform_private.inquiry_events(inquiry_id,id desc);
create table platform_private.inquiry_access_events (
 id bigint generated always as identity primary key, actor_id uuid not null references auth.users(id),
 action text not null check(action in ('list','detail','events','assignees')), inquiry_id text,
 created_at timestamptz not null default clock_timestamp()
);
create index inquiries_status_id on public.inquiries(status,id);
create index inquiries_assignee on public.inquiries(assigned_to);

do $$ declare t text; c text; policy_name text; begin
 foreach t in array array['inquiry_commands','inquiry_events','inquiry_access_events'] loop
  execute format('alter table platform_private.%I enable row level security',t);
  execute format('revoke all on platform_private.%I from public,anon,authenticated,service_role',t);
 end loop;
 -- Includes manually-added policies: no historical permissive OR policy survives.
 for policy_name in select policyname from pg_policies where schemaname='public' and tablename='inquiries' loop
  execute format('drop policy %I on public.inquiries',policy_name);
 end loop;
 revoke all on public.inquiries from public,anon,authenticated;
 -- Table REVOKE alone does not revoke column grants.
 for c in select attname from pg_attribute where attrelid='public.inquiries'::regclass and attnum>0 and not attisdropped loop
  execute format('revoke select(%I),insert(%I),update(%I),references(%I) on public.inquiries from public,anon,authenticated',c,c,c,c);
 end loop;
end $$;
alter table public.inquiries enable row level security;
grant insert(company,name,phone,email,project_type,message) on public.inquiries to anon,authenticated;
grant usage on sequence public.inquiry_id_seq to anon,authenticated;
create policy inquiry_public_form_only on public.inquiries for insert to anon,authenticated
 with check(status='접수대기' and revision=1 and assigned_to is null and reply_content is null and replied_at is null
 and reply_saved_at is null and delivery_status='not_sent' and admin_notes='[]'::jsonb and status_history='[]'::jsonb);

-- Existing notification triggers copy company/contact names. A restrictive policy
-- closes that indirect read/write path even when old permissive policies remain.
create policy inquiry_notification_admin_only on public.admin_notifications as restrictive for all to authenticated
 using ((type is distinct from 'inquiry' and inquiry_id is null) or
 ((select auth.uid()) is not null and (select auth.jwt()->>'aal')='aal2' and exists
 (select 1 from public.user_roles where user_id=(select auth.uid()) and role='super_admin')))
 with check ((type is distinct from 'inquiry' and inquiry_id is null) or
 ((select auth.uid()) is not null and (select auth.jwt()->>'aal')='aal2' and exists
 (select 1 from public.user_roles where user_id=(select auth.uid()) and role='super_admin')));

create function platform_private.assert_inquiry_admin() returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); begin
 if actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
 -- Current DB role, never user_metadata or a cached command receipt. Hold until transaction ends.
 perform 1 from public.user_roles r join auth.users u on u.id=r.user_id where r.user_id=actor and r.role='super_admin' for share of r;
 if not found then raise exception 'inquiry_access_denied' using errcode='42501'; end if;
 return actor;
end $$;
revoke all on function platform_private.assert_inquiry_admin() from public,anon,authenticated;

create function platform_private.inquiry_list(p_status text,p_after text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb; begin
 actor:=platform_private.assert_inquiry_admin();
 if p_status is null or p_status not in ('all','접수대기','검토중','보류','답변완료') then raise exception 'invalid_inquiry_filter' using errcode='22023'; end if;
 if p_after is not null and (length(p_after)=0 or length(p_after)>200) then raise exception 'invalid_inquiry_cursor' using errcode='22023'; end if;
 with page as (select id,company,name,project_type,status,assigned_to,revision,created_at,updated_at,reply_saved_at,delivery_status
 from public.inquiries where (p_status='all' or status=p_status) and (p_after is null or id>p_after) order by id limit 51),
 shown as (select * from page order by id limit 50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(s) order by id) from shown s),'[]'::jsonb),
 'next_cursor',case when (select count(*) from page)>50 then (select max(id) from shown) end) into result;
 insert into platform_private.inquiry_access_events(actor_id,action) values(actor,'list');
 return result;
end $$;

create function platform_private.inquiry_assignees(p_after uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb; begin
 actor:=platform_private.assert_inquiry_admin();
 with page as (select r.user_id,r.display_name from public.user_roles r join auth.users u on u.id=r.user_id
 where r.role='super_admin' and (p_after is null or r.user_id>p_after) order by r.user_id limit 51),
 shown as (select * from page order by user_id limit 50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(s) order by user_id) from shown s),'[]'::jsonb),
 'next_cursor',case when (select count(*) from page)>50 then (select user_id from shown order by user_id desc limit 1) end) into result;
 insert into platform_private.inquiry_access_events(actor_id,action) values(actor,'assignees');
 return result;
end $$;

create function platform_private.inquiry_detail(p_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; inquiry public.inquiries; events jsonb; begin
 actor:=platform_private.assert_inquiry_admin();
 select * into inquiry from public.inquiries where id=p_id;
 if not found then raise exception 'inquiry_unavailable'; end if;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('id',e.id::text) order by e.id desc),'[]'::jsonb) into events
 from (select * from platform_private.inquiry_events where inquiry_id=p_id order by id desc limit 100) e;
 insert into platform_private.inquiry_access_events(actor_id,action,inquiry_id) values(actor,'detail',p_id);
 return jsonb_build_object('inquiry',to_jsonb(inquiry),'events',events);
end $$;

create function platform_private.inquiry_events_page(p_id text,p_before bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb; begin
 actor:=platform_private.assert_inquiry_admin();
 if p_before is not null and p_before<=0 then raise exception 'invalid_inquiry_cursor' using errcode='22023'; end if;
 if not exists(select 1 from public.inquiries where id=p_id) then raise exception 'inquiry_unavailable'; end if;
 with page as (select * from platform_private.inquiry_events where inquiry_id=p_id and (p_before is null or id<p_before) order by id desc limit 51),
 shown as (select * from page order by id desc limit 50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('id',s.id::text) order by id desc) from shown s),'[]'::jsonb),
 'next_cursor',case when (select count(*) from page)>50 then (select min(id)::text from shown) end) into result;
 insert into platform_private.inquiry_access_events(actor_id,action,inquiry_id) values(actor,'events',p_id);
 return result;
end $$;

create function platform_private.inquiry_command(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; inquiry public.inquiries; cached platform_private.inquiry_commands; fingerprint text;
 required_keys text[]; target uuid; body text; reason text; new_status text; event_data jsonb:='{}'::jsonb; result jsonb; begin
 actor:=platform_private.assert_inquiry_admin();
 if p_request_id is null or p_action is null or p_action not in ('assign','note','save_reply','start_review','hold','resume','complete','reopen')
 or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid_inquiry_command' using errcode='22023'; end if;
 required_keys:=array['id','expected_revision',case when p_action='assign' then 'assigned_to' when p_action in ('note','save_reply') then 'body' else 'reason' end];
 if not (p_payload ?& required_keys) or (p_payload-required_keys)<>'{}'::jsonb
 or jsonb_typeof(p_payload->'id') is distinct from 'string' or length(p_payload->>'id') not between 1 and 200
 or jsonb_typeof(p_payload->'expected_revision') is distinct from 'number' or (p_payload->>'expected_revision') !~ '^[1-9][0-9]{0,8}$'
 then raise exception 'invalid_inquiry_command' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('inquiry-command:'||actor::text,0));
 fingerprint:=encode(extensions.digest(p_payload::text,'sha256'),'hex');
 select * into cached from platform_private.inquiry_commands where actor_id=actor and request_id=p_request_id;
 if found then
  if cached.action<>p_action or cached.payload_digest<>fingerprint then raise exception 'idempotency_conflict'; end if;
  return cached.result;
 end if;
 select * into inquiry from public.inquiries where id=p_payload->>'id' for update;
 if not found then raise exception 'inquiry_unavailable'; end if;
 if inquiry.revision<>(p_payload->>'expected_revision')::integer then raise exception 'version_conflict'; end if;
 if p_action='assign' then
  if p_payload->'assigned_to'<>'null'::jsonb then
   if jsonb_typeof(p_payload->'assigned_to') is distinct from 'string' or (p_payload->>'assigned_to') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid_assignee' using errcode='22023'; end if;
   target:=(p_payload->>'assigned_to')::uuid;
   perform 1 from public.user_roles where user_id=target and role='super_admin' for share;
   if not found then raise exception 'invalid_assignee' using errcode='22023'; end if;
  end if;
  inquiry.assigned_to:=target;event_data:=jsonb_build_object('assigned_to',target);
 elsif p_action in ('note','save_reply') then
  body:=btrim(p_payload->>'body');
  if jsonb_typeof(p_payload->'body') is distinct from 'string' or length(body) not between 1 and (case when p_action='note' then 2000 else 5000 end) then raise exception 'invalid_body' using errcode='22023'; end if;
  if p_action='note' then event_data:=jsonb_build_object('body',body);
  else
   if inquiry.status='답변완료' then raise exception 'invalid_transition'; end if;
   inquiry.reply_content:=body;inquiry.reply_saved_at:=clock_timestamp();inquiry.delivery_status:='not_sent';
   event_data:=jsonb_build_object('length',length(body),'delivery_status','not_sent');
  end if;
 else
  reason:=btrim(p_payload->>'reason');
  if jsonb_typeof(p_payload->'reason') is distinct from 'string' or length(reason) not between 1 and 500 then raise exception 'invalid_reason' using errcode='22023'; end if;
  new_status:=case
   when p_action='start_review' and inquiry.status='접수대기' then '검토중'
   when p_action='hold' and inquiry.status in ('접수대기','검토중') then '보류'
   when p_action='resume' and inquiry.status='보류' then '검토중'
   when p_action='complete' and inquiry.status='검토중' then '답변완료'
   when p_action='reopen' and inquiry.status='답변완료' then '검토중' end;
  if new_status is null then raise exception 'invalid_transition'; end if;
  if p_action='complete' and length(btrim(coalesce(inquiry.reply_content,'')))=0 then raise exception 'reply_required'; end if;
  event_data:=jsonb_build_object('from',inquiry.status,'to',new_status,'reason',reason);inquiry.status:=new_status;
 end if;
 update public.inquiries set assigned_to=inquiry.assigned_to,status=inquiry.status,reply_content=inquiry.reply_content,
 reply_saved_at=inquiry.reply_saved_at,delivery_status=inquiry.delivery_status,revision=revision+1,updated_at=clock_timestamp()
 where id=inquiry.id returning * into inquiry;
 insert into platform_private.inquiry_events(inquiry_id,actor_id,action,data,revision) values(inquiry.id,actor,p_action,event_data,inquiry.revision);
 result:=jsonb_build_object('id',inquiry.id,'revision',inquiry.revision,'status',inquiry.status,'assigned_to',inquiry.assigned_to,'reply_saved_at',inquiry.reply_saved_at,'delivery_status',inquiry.delivery_status);
 insert into platform_private.inquiry_commands(actor_id,request_id,action,payload_digest,result) values(actor,p_request_id,p_action,fingerprint,result);
 return result;
end $$;

-- Public invoker wrappers expose only the checked private operations.
create function public.platform_inquiry_list(p_status text default 'all',p_after text default null) returns jsonb
language sql security invoker set search_path='' as $$ select platform_private.inquiry_list(p_status,p_after) $$;
create function public.platform_inquiry_assignees(p_after uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select platform_private.inquiry_assignees(p_after) $$;
create function public.platform_inquiry_detail(p_id text) returns jsonb
language sql security invoker set search_path='' as $$ select platform_private.inquiry_detail(p_id) $$;
create function public.platform_inquiry_events(p_id text,p_before bigint default null) returns jsonb
language sql security invoker set search_path='' as $$ select platform_private.inquiry_events_page(p_id,p_before) $$;
create function public.platform_inquiry_command(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select platform_private.inquiry_command(p_request_id,p_action,p_payload) $$;

do $$ declare signature text; begin
 foreach signature in array array[
 'platform_private.inquiry_assignees(uuid)','public.platform_inquiry_assignees(uuid)',
 'platform_private.inquiry_list(text,text)','platform_private.inquiry_detail(text)',
 'platform_private.inquiry_events_page(text,bigint)','platform_private.inquiry_command(uuid,text,jsonb)',
 'public.platform_inquiry_list(text,text)','public.platform_inquiry_detail(text)',
 'public.platform_inquiry_events(text,bigint)','public.platform_inquiry_command(uuid,text,jsonb)'] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated,service_role';
  execute 'grant execute on function '||signature||' to authenticated';
 end loop;
end $$;
commit;

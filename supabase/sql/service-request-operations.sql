-- Own-site service requests and a separate headquarters queue. No device/payment rights.
alter table public.sgp_service_requests
 add column site_id uuid references public.platform_sites(id),
 add column revision integer not null default 1 check(revision>0),
 add column assigned_to uuid references auth.users(id),
 add column due_at timestamptz;
create index service_requests_site_cursor on public.sgp_service_requests(site_id,id);
create index service_requests_assignee on public.sgp_service_requests(assigned_to) where assigned_to is not null;
create index service_requests_open_due on public.sgp_service_requests(site_id,due_at) where status in ('submitted','reviewing');
create index service_requests_reviewed_by on public.sgp_service_requests(reviewed_by) where reviewed_by is not null;
create table platform_private.service_request_commands(
 actor_id uuid not null references auth.users(id),request_id uuid not null,action text not null,payload_digest text not null,
 result jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
create table platform_private.service_request_events(
 id bigint generated always as identity primary key,request_id uuid not null references public.sgp_service_requests(id),
 actor_id uuid not null references auth.users(id),action text not null,reason text not null default '',
 details jsonb not null,created_at timestamptz not null default now()
);
create index service_request_events_request on platform_private.service_request_events(request_id,id desc);
create index service_request_events_actor on platform_private.service_request_events(actor_id);
alter table platform_private.service_request_commands enable row level security;
alter table platform_private.service_request_events enable row level security;
revoke all on platform_private.service_request_commands,platform_private.service_request_events from public,anon,authenticated,service_role;
-- Remove both table and legacy column grants; an UPDATE column grant survives a table REVOKE.
revoke all on public.sgp_service_requests from public,anon,authenticated;
revoke insert(user_id,client_request_id,category,subject,description),update(status,response) on public.sgp_service_requests from public,anon,authenticated;

create function platform_private.assert_service_request_session() returns void
language plpgsql security definer set search_path='' as $$
declare sid text:=auth.jwt()->>'session_id'; live uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if sid is null or sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'reauthentication_required' using errcode='42501'; end if;
 select s.id into live from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=sid::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>clock_timestamp())
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share of s;
 if live is null then raise exception 'reauthentication_required' using errcode='42501'; end if;
end $$;
create function platform_private.can_handle_service_request(person uuid,site uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles r join auth.users u on u.id=r.user_id
 where r.user_id=person and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp())
 and (r.role='super_admin' or (site is not null and r.role in ('admin','manager','operator','viewer') and exists(
 select 1 from platform_private.site_staff st where st.site_id=site and st.user_id=person and st.active and st.valid_until>statement_timestamp() and st.role='manager'))));
$$;
create function platform_private.assert_service_request_scope(site uuid,write_access boolean default false) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
 if site is null then
  if not platform_private.is_headquarters() then raise exception 'headquarters_required' using errcode='42501'; end if;
 else perform platform_private.assert_site_access(site,write_access); end if;
end $$;
revoke all on function platform_private.assert_service_request_session(),platform_private.can_handle_service_request(uuid,uuid),platform_private.assert_service_request_scope(uuid,boolean) from public,anon,authenticated,service_role;

create or replace function platform_private.guard_service_request() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user not in ('postgres','service_role') then raise exception 'request_rpc_required' using errcode='42501'; end if;
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if new.user_id<>auth.uid() then raise exception 'owner_mismatch'; end if;
  if new.status<>'submitted' or new.response is not null or new.reviewed_at is not null or new.reviewed_by is not null or new.assigned_to is not null or new.due_at is not null or new.revision<>1 then raise exception 'invalid_initial_state'; end if;
 else
  perform platform_private.assert_service_request_scope(old.site_id,true);
  if (new.id,new.user_id,new.client_request_id,new.category,new.subject,new.description,new.created_at) is distinct from (old.id,old.user_id,old.client_request_id,old.category,old.subject,old.description,old.created_at) then raise exception 'immutable_request_content'; end if;
  if old.status in ('resolved','rejected') then raise exception 'request_closed'; end if;
  if new.revision<>old.revision+1 then raise exception 'version_conflict'; end if;
  if new.site_id is distinct from old.site_id and (old.site_id is not null or new.site_id is null or not platform_private.is_headquarters()) then raise exception 'request_scope_conflict'; end if;
  if new.status<>old.status and not ((old.status='submitted' and new.status='reviewing') or (old.status='reviewing' and new.status in ('resolved','rejected'))) then raise exception 'invalid_transition'; end if;
  if new.status in ('resolved','rejected') and length(btrim(coalesce(new.response,'')))<2 then raise exception 'response_required'; end if;
  new.reviewed_at:=clock_timestamp();new.reviewed_by:=auth.uid();
 end if;
 return new;
end $$;
create or replace function platform_private.audit_service_request() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'audit_actor_required'; end if;
 if tg_op='INSERT' and new.user_id<>auth.uid() then raise exception 'audit_owner_mismatch'; end if;
 if tg_op='UPDATE' then perform platform_private.assert_service_request_scope(old.site_id,true); end if;
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(auth.uid(),new.id,case when tg_op='INSERT' then 'request.submitted' else 'request.updated' end,jsonb_build_object('status',new.status,'revision',new.revision,'site_id',new.site_id));
 return new;
end $$;

create function public.sgp_submit_service_request(p_client_request_id uuid,p_category text,p_subject text,p_description text,p_site_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing public.sgp_service_requests; result uuid;
begin
 perform platform_private.assert_service_request_session();
 if not exists(select 1 from public.sgp_users where id=auth.uid() and is_verified and status='active' and phone_verified_at is not null) then raise exception 'phone_verification_required' using errcode='42501'; end if;
 if p_client_request_id is null or p_category is null or p_category not in ('residence','vehicle','visit','concierge') or p_subject is null or length(btrim(p_subject)) not between 2 and 80 or p_description is null or length(btrim(p_description)) not between 5 and 2000 then raise exception 'invalid_service_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('service-request-user:'||auth.uid()::text,0));
 select * into existing from public.sgp_service_requests where user_id=auth.uid() and client_request_id=p_client_request_id;
 if found then
  -- site may be assigned later; compare original submission scope in immutable event.
  if existing.category<>p_category or existing.subject<>btrim(p_subject) or existing.description<>btrim(p_description)
   or (select (details->>'site_id')::uuid from platform_private.service_request_events where request_id=existing.id and action='submitted' order by id limit 1) is distinct from p_site_id then raise exception 'idempotency_conflict'; end if;
  return existing.id;
 end if;
 if p_site_id is not null and not exists(select 1 from public.platform_site_members m join public.platform_sites s on s.id=m.site_id where m.site_id=p_site_id and m.user_id=auth.uid() and m.status='active' and s.organization_id is not null and s.phase in ('sandbox','site_acceptance','ready')) then raise exception 'request_site_unavailable' using errcode='42501'; end if;
 if (select count(*) from public.sgp_service_requests where user_id=auth.uid() and created_at>now()-interval '5 minutes')>=5 then raise exception 'rate_limited'; end if;
 insert into public.sgp_service_requests(user_id,client_request_id,category,subject,description,site_id) values(auth.uid(),p_client_request_id,p_category,btrim(p_subject),btrim(p_description),p_site_id) returning id into result;
 insert into platform_private.service_request_events(request_id,actor_id,action,details) values(result,auth.uid(),'submitted',jsonb_build_object('site_id',p_site_id,'revision',1));
 return result;
end $$;
-- Preserve old clients: their four-argument submissions go to headquarters.
create or replace function public.sgp_submit_service_request(p_client_request_id uuid,p_category text,p_subject text,p_description text) returns uuid
language sql security definer set search_path='' as $$
 select public.sgp_submit_service_request(p_client_request_id,p_category,p_subject,p_description,null::uuid);
$$;

create function public.platform_service_request_command(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); scope uuid; target uuid; assignee uuid; deadline timestamptz; row public.sgp_service_requests;
 cached platform_private.service_request_commands; fingerprint text; reason text; response_text text; next_status text; result jsonb;
begin
 perform platform_private.assert_service_request_session();
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_action is null or p_action not in ('route','assign','review') or not(p_payload?'site_id') then raise exception 'invalid_service_request_command'; end if;
 scope:=(p_payload->>'site_id')::uuid;
 perform platform_private.assert_service_request_scope(scope,true);
 perform pg_advisory_xact_lock(hashtextextended('service-request-command:'||actor::text,0));
 fingerprint:=encode(extensions.digest(p_payload::text,'sha256'),'hex');
 select * into cached from platform_private.service_request_commands where actor_id=actor and request_id=p_request_id;
 if found then
  if cached.action<>p_action or cached.payload_digest<>fingerprint then raise exception 'idempotency_conflict'; end if;
  return cached.result;
 end if;
 select * into row from public.sgp_service_requests where id=(p_payload->>'id')::uuid and site_id is not distinct from scope for update;
 if row.id is null then raise exception 'request_scope_conflict' using errcode='42501'; end if;
 if row.revision is distinct from (p_payload->>'expected_revision')::integer then raise exception 'version_conflict'; end if;
 if row.status in ('resolved','rejected') then raise exception 'request_closed'; end if;
 reason:=btrim(coalesce(p_payload->>'reason',''));if length(reason) not between 5 and 500 then raise exception 'reason_required'; end if;
 if p_action='route' then
  if p_payload->>'confirmed' is distinct from 'true' then raise exception 'route_confirmation_required'; end if;
  if scope is not null or not platform_private.is_headquarters() then raise exception 'headquarters_required' using errcode='42501'; end if;
  target:=(p_payload->>'target_site_id')::uuid;
  if target is null or not exists(select 1 from public.platform_site_members m join public.platform_sites s on s.id=m.site_id where m.site_id=target and m.user_id=row.user_id and m.status='active' and s.organization_id is not null and s.phase in ('sandbox','site_acceptance','ready')) then raise exception 'request_site_unavailable'; end if;
  update public.sgp_service_requests set site_id=target,assigned_to=null,due_at=null,revision=revision+1 where id=row.id;
 elsif p_action='assign' then
  assignee:=nullif(p_payload->>'assignee_id','')::uuid;deadline:=nullif(p_payload->>'due_at','')::timestamptz;
  if assignee is null and deadline is not null then raise exception 'assignee_required'; end if;
  if assignee is not null and not platform_private.can_handle_service_request(assignee,scope) then raise exception 'assignee_unavailable'; end if;
  if deadline is not null and (deadline<=clock_timestamp() or deadline>clock_timestamp()+interval '30 days') then raise exception 'invalid_due_at'; end if;
  update public.sgp_service_requests set assigned_to=assignee,due_at=deadline,revision=revision+1 where id=row.id;
 else
  if row.assigned_to is distinct from actor or not platform_private.can_handle_service_request(actor,scope) then raise exception 'assigned_actor_required' using errcode='42501'; end if;
  next_status:=p_payload->>'status';response_text:=nullif(btrim(p_payload->>'response'),'');
  if next_status is null or not ((row.status='submitted' and next_status='reviewing') or (row.status='reviewing' and next_status in ('resolved','rejected'))) then raise exception 'invalid_transition'; end if;
  if length(coalesce(response_text,''))>2000 or (next_status in ('resolved','rejected') and length(coalesce(response_text,''))<2) then raise exception 'response_required'; end if;
  update public.sgp_service_requests set status=next_status,response=response_text,revision=revision+1 where id=row.id;
 end if;
 result:=jsonb_build_object('id',row.id,'revision',row.revision+1);
 insert into platform_private.service_request_events(request_id,actor_id,action,reason,details)
 select row.id,actor,p_action,reason,jsonb_build_object('from_site_id',row.site_id,'site_id',r.site_id,'status',r.status,'revision',r.revision,'assigned_to',r.assigned_to,'due_at',r.due_at,'response',case when p_action='review' then r.response else null end) from public.sgp_service_requests r where id=row.id;
 insert into platform_private.service_request_commands(actor_id,request_id,action,payload_digest,result) values(actor,p_request_id,p_action,fingerprint,result);
 return result;
end $$;

create function public.platform_service_request_snapshot(p_site_id uuid default null,p_status text default 'open',p_after uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rows jsonb; page jsonb;
begin
 perform platform_private.assert_service_request_session();perform platform_private.assert_service_request_scope(p_site_id);
 if p_status is null or p_status not in ('open','all','submitted','reviewing','resolved','rejected','overdue','unassigned') then raise exception 'invalid_filter'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into rows from (
  select r.id,r.site_id,r.category,r.subject,r.status,r.revision,r.assigned_to,r.due_at,r.created_at,
  coalesce(u.display_name,'회원') as requester,coalesce(nullif(a.display_name,''),'담당자') as assignee_name,
  (r.status in ('submitted','reviewing') and r.due_at<statement_timestamp()) is true as overdue
  from public.sgp_service_requests r left join public.sgp_users u on u.id=r.user_id left join public.user_roles a on a.user_id=r.assigned_to
  where (r.site_id=p_site_id or (p_site_id is null and r.site_id is null)) and (p_after is null or r.id>p_after)
  and (p_status='all' or r.status=p_status or (p_status='open' and r.status in ('submitted','reviewing'))
   or (p_status='overdue' and r.status in ('submitted','reviewing') and r.due_at<statement_timestamp()) or (p_status='unassigned' and r.status in ('submitted','reviewing') and r.assigned_to is null)) order by r.id limit 51
 )x;
 select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into page from jsonb_array_elements(rows) with ordinality where ordinality<=50;
 return jsonb_build_object('schema_version',1,'site_id',p_site_id,'headquarters',platform_private.is_headquarters(),
 'can_manage',platform_private.can_handle_service_request(auth.uid(),p_site_id),'rows',page,
 'counts',(select jsonb_build_object('open',count(*) filter(where status in ('submitted','reviewing')),'unassigned',count(*) filter(where status in ('submitted','reviewing') and assigned_to is null),'overdue',count(*) filter(where status in ('submitted','reviewing') and due_at<statement_timestamp())) from public.sgp_service_requests where (site_id=p_site_id or (p_site_id is null and site_id is null))),
 'assignees',coalesce((select jsonb_agg(jsonb_build_object('id',r.user_id,'name',coalesce(nullif(r.display_name,''),'담당자')) order by r.user_id) from public.user_roles r where platform_private.can_handle_service_request(r.user_id,p_site_id)),'[]'::jsonb),
 'next_cursor',case when jsonb_array_length(rows)>50 then page->49->>'id' else null end,'observed_at',statement_timestamp());
end $$;
create function public.platform_service_request_detail(p_id uuid,p_site_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.sgp_service_requests;
begin
 perform platform_private.assert_service_request_session();perform platform_private.assert_service_request_scope(p_site_id);
 select * into row from public.sgp_service_requests where id=p_id and site_id is not distinct from p_site_id;
 if row.id is null then raise exception 'request_scope_conflict' using errcode='42501'; end if;
 return jsonb_build_object('schema_version',1,'request',jsonb_build_object('id',row.id,'site_id',row.site_id,'revision',row.revision,'subject',row.subject,'description',row.description,'status',row.status,'response',row.response,'assigned_to',row.assigned_to,'due_at',row.due_at),
 'history',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id::bigint desc) from(select e.id::text as id,actor_id,action,reason,details,created_at from platform_private.service_request_events e where request_id=row.id order by e.id desc limit 30)x),'[]'::jsonb),'observed_at',statement_timestamp());
end $$;
create function public.platform_my_service_requests() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform platform_private.assert_service_request_session();
 return jsonb_build_object('schema_version',1,'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from(
 select r.id,r.site_id,s.name as site_name,r.category,r.subject,r.description,r.status,r.response,r.created_at,r.due_at,r.reviewed_at,
 (r.status in ('submitted','reviewing') and r.due_at<statement_timestamp()) is true as overdue
 from public.sgp_service_requests r left join public.platform_sites s on s.id=r.site_id where r.user_id=auth.uid() order by r.created_at desc,r.id desc limit 30)x),'[]'::jsonb),'observed_at',statement_timestamp());
end $$;
revoke all on function public.sgp_submit_service_request(uuid,text,text,text),public.sgp_submit_service_request(uuid,text,text,text,uuid),public.platform_service_request_command(uuid,text,jsonb),public.platform_service_request_snapshot(uuid,text,uuid),public.platform_service_request_detail(uuid,uuid),public.platform_my_service_requests() from public,anon,authenticated,service_role;
grant execute on function public.sgp_submit_service_request(uuid,text,text,text),public.sgp_submit_service_request(uuid,text,text,text,uuid),public.platform_service_request_command(uuid,text,jsonb),public.platform_service_request_snapshot(uuid,text,uuid),public.platform_service_request_detail(uuid,uuid),public.platform_my_service_requests() to authenticated;

-- Building/unit master data. No ownership, parking, device or payment entitlement.
create table platform_private.site_buildings (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.platform_sites(id),
 label text not null check(length(btrim(label)) between 1 and 30), active boolean not null default true,
 revision integer not null default 1, created_at timestamptz not null default clock_timestamp(), unique(site_id,id), unique(site_id,label)
);
create table platform_private.site_units (
 id uuid primary key default gen_random_uuid(), site_id uuid not null, building_id uuid not null,
 label text not null check(length(btrim(label)) between 1 and 30), active boolean not null default true,
 revision integer not null default 1, created_at timestamptz not null default clock_timestamp(), unique(site_id,id), unique(building_id,label),
 foreign key(site_id,building_id) references platform_private.site_buildings(site_id,id)
);
create index site_units_directory on platform_private.site_units(site_id,building_id,id);
create table platform_private.site_residence_policies (
 site_id uuid primary key references public.platform_sites(id), mode text not null check(mode in('free_text','registered_unit')),
 revision integer not null, updated_by uuid not null references auth.users(id), updated_at timestamptz not null default clock_timestamp()
);
alter table public.platform_site_members add column unit_id uuid,
 add constraint platform_member_registered_unit foreign key(site_id,unit_id) references platform_private.site_units(site_id,id);
alter table platform_private.membership_requests add column unit_id uuid,
 add constraint membership_request_registered_unit foreign key(site_id,unit_id) references platform_private.site_units(site_id,id);
create index platform_members_by_unit on public.platform_site_members(site_id,unit_id) where unit_id is not null;
do $$ declare t text; begin
 foreach t in array array['site_buildings','site_units','site_residence_policies'] loop
  execute format('alter table platform_private.%I enable row level security',t);
  execute format('revoke all on platform_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

-- Called only inside the membership command's actor/site locks and atomic audit.
create function platform_private.residence_change(actor uuid,site uuid,action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare subject uuid; parent uuid; label text; next_active boolean; rev integer; old_rev integer; mode text; target uuid; canonical_label text;
begin
 if actor is distinct from auth.uid() or actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
 perform platform_private.assert_site_access(site,true);
 if action in('set_building_active','set_unit_active','residence_policy') and length(btrim(coalesce(payload->>'reason',''))) not between 5 and 500 then raise exception 'reason_required'; end if;
 if action in('create_building','create_unit') then
  label:=btrim(coalesce(payload->>'label',''));
  if length(label) not between 1 and 30 then raise exception 'invalid_residence_label'; end if;
  if action='create_building' then
   insert into platform_private.site_buildings(site_id,label) values(site,label) returning id into subject;
  else
   parent:=(payload->>'building_id')::uuid;
   if not exists(select 1 from platform_private.site_buildings b where b.id=parent and b.site_id=site and b.active) then raise exception 'building_unavailable'; end if;
   insert into platform_private.site_units(site_id,building_id,label) values(site,parent,label) returning id into subject;
  end if;
  return jsonb_build_object('id',subject,'revision',1);
 elsif action in('set_building_active','set_unit_active') then
  subject:=(payload->>'id')::uuid;
  if jsonb_typeof(payload->'active') is distinct from 'boolean' then raise exception 'invalid_residence_state'; end if;
  next_active:=(payload->>'active')::boolean;
  if action='set_building_active' then
   select revision into old_rev from platform_private.site_buildings where id=subject and site_id=site;
  else
   select revision,building_id into old_rev,parent from platform_private.site_units where id=subject and site_id=site;
  end if;
  if old_rev is null then raise exception 'residence_unavailable'; end if;
  if old_rev is distinct from (payload->>'expected_revision')::integer then raise exception 'version_conflict'; end if;
  if action='set_building_active' then
   if not next_active and exists(select 1 from platform_private.site_units where site_id=site and building_id=subject and active) then raise exception 'building_has_active_units'; end if;
   update platform_private.site_buildings set active=next_active,revision=revision+1 where id=subject;
  else
   if next_active and not exists(select 1 from platform_private.site_buildings where id=parent and site_id=site and active) then raise exception 'building_unavailable'; end if;
   if not next_active and exists(select 1 from public.platform_site_members where site_id=site and unit_id=subject and status='active') then raise exception 'unit_in_use'; end if;
   update platform_private.site_units set active=next_active,revision=revision+1 where id=subject;
  end if;
  return jsonb_build_object('id',subject,'revision',old_rev+1);
 elsif action='residence_policy' then
  select revision into old_rev from platform_private.site_residence_policies where site_id=site;
  if coalesce(old_rev,0) is distinct from (payload->>'expected_revision')::integer then raise exception 'version_conflict'; end if;
  mode:=payload->>'mode';
  if mode is null or mode not in('free_text','registered_unit') then raise exception 'invalid_residence_policy'; end if;
  if mode='registered_unit' then
   if not exists(select 1 from platform_private.site_units u join platform_private.site_buildings b on b.site_id=u.site_id and b.id=u.building_id where u.site_id=site and u.active and b.active) then raise exception 'active_unit_required'; end if;
   if exists(select 1 from public.platform_site_members where site_id=site and status='active' and unit_id is null) then raise exception 'unmapped_active_members'; end if;
  end if;
  rev:=coalesce(old_rev,0)+1;
  insert into platform_private.site_residence_policies(site_id,mode,revision,updated_by) values(site,mode,rev,actor)
  on conflict(site_id) do update set mode=excluded.mode,revision=excluded.revision,updated_by=actor,updated_at=clock_timestamp();
  return jsonb_build_object('id',site,'revision',rev);
 elsif action='link_member_unit' then
  target:=(payload->>'user_id')::uuid; subject:=(payload->>'unit_id')::uuid;
  if actor=target then raise exception 'independent_approver_required' using errcode='42501'; end if;
  if length(btrim(coalesce(payload->>'reason',''))) not between 5 and 500 then raise exception 'reason_required'; end if;
  select revision into old_rev from public.platform_site_members where site_id=site and user_id=target and status='active';
  if old_rev is null then raise exception 'active_member_required'; end if;
  if old_rev is distinct from (payload->>'expected_revision')::integer then raise exception 'version_conflict'; end if;
  select b.label||' '||u.label into canonical_label from platform_private.site_units u join platform_private.site_buildings b on b.site_id=u.site_id and b.id=u.building_id where u.id=subject and u.site_id=site and u.active and b.active;
  if canonical_label is null then raise exception 'unit_unavailable'; end if;
  if not exists(select 1 from public.sgp_users where id=target and is_verified and status='active' and phone_verified_at is not null) then raise exception 'phone_verification_required' using errcode='42501'; end if;
  update public.platform_site_members set unit_id=subject,unit_label=canonical_label,revision=revision+1 where site_id=site and user_id=target;
  return jsonb_build_object('id',subject,'user_id',target,'revision',old_rev+1);
 end if;
 raise exception 'invalid_residence_command';
end $$;
revoke all on function platform_private.residence_change(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;

create function public.platform_residence_directory(p_site_id uuid,p_building_id uuid default null,p_after uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; page jsonb; policy jsonb; manageable boolean;
begin
 perform platform_private.assert_site_access(p_site_id);
 manageable:=platform_private.is_headquarters() or exists(select 1 from platform_private.site_staff where site_id=p_site_id and user_id=auth.uid() and active and valid_until>statement_timestamp() and role='manager');
 if p_building_id is null then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into rows from (
   select id,label,active,revision from platform_private.site_buildings where site_id=p_site_id and (p_after is null or id>p_after) order by id limit 51
  )x;
 else
  if not exists(select 1 from platform_private.site_buildings where id=p_building_id and site_id=p_site_id) then raise exception 'building_unavailable'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into rows from (
   select u.id,u.building_id,u.label,u.active,u.revision,(select count(*) from public.platform_site_members m where m.site_id=p_site_id and m.unit_id=u.id and m.status='active') as active_members
   from platform_private.site_units u where u.site_id=p_site_id and u.building_id=p_building_id and (p_after is null or u.id>p_after) order by u.id limit 51
  )x;
 end if;
 select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into page from jsonb_array_elements(rows) with ordinality where ordinality<=50;
 select jsonb_build_object('mode',mode,'revision',revision) into policy from platform_private.site_residence_policies where site_id=p_site_id;
 return jsonb_build_object('schema_version',1,'site_id',p_site_id,'building_id',p_building_id,'can_manage',manageable,'policy',coalesce(policy,'{"mode":"free_text","revision":0}'::jsonb),
  'unmapped_active_members',(select count(*) from public.platform_site_members where site_id=p_site_id and status='active' and unit_id is null),
  'rows',page,'next_cursor',case when jsonb_array_length(rows)>50 then page->49->>'id' else null end,'observed_at',statement_timestamp());
end $$;
revoke all on function public.platform_residence_directory(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.platform_residence_directory(uuid,uuid,uuid) to authenticated;

-- Roll forward existing RPCs; historical migration remains unchanged.
create or replace function public.platform_membership_command(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); site uuid; target uuid; subject uuid; token text; fingerprint text; result jsonb; cached platform_private.membership_commands;
 invite platform_private.membership_invites; application platform_private.membership_requests; member public.platform_site_members;
 profile platform_private.membership_site_profiles; decision_reason text; decision text; rev integer; unit_name text; phase text; selected_unit uuid; canonical_label text; residence_mode text;
begin
 if actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_action not in ('profile','issue_invite','revoke_invite','apply','withdraw','review','revoke_member','create_building','create_unit','set_building_active','set_unit_active','residence_policy','link_member_unit') or p_action is null then raise exception 'invalid_membership_command' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('membership-command:'||actor::text,0));
 fingerprint:=encode(extensions.digest(p_payload::text,'sha256'),'hex');
 if p_action='apply' then
  if not exists(select 1 from public.sgp_users where id=actor and is_verified and status='active' and phone_verified_at is not null) then raise exception 'phone_verification_required' using errcode='42501'; end if;
  -- A receipt can be retrieved after invite expiry; it does not grant membership.
  select * into cached from platform_private.membership_commands where actor_id=actor and request_id=p_request_id;
  if found then
   if cached.action<>p_action or cached.payload_digest<>fingerprint then raise exception 'idempotency_conflict'; end if;
   return cached.result;
  end if;
  token:=p_payload->>'code';
  if token is null or token !~ '^[0-9a-f]{64}$' then raise exception 'invite_unavailable'; end if;
  select * into invite from platform_private.membership_invites where token_hash=encode(extensions.digest(token,'sha256'),'hex');
  if invite.id is null or invite.revoked or invite.expires_at<=clock_timestamp() or invite.uses>=invite.max_uses then raise exception 'invite_unavailable'; end if;
  site:=invite.site_id; target:=actor;
 elsif p_action='withdraw' then
  select * into application from platform_private.membership_requests where id=(p_payload->>'id')::uuid and user_id=actor;
  if application.id is null then raise exception 'application_unavailable' using errcode='42501'; end if;
  site:=application.site_id; target:=actor;
 else
  site:=(p_payload->>'site_id')::uuid;
  perform platform_private.assert_site_access(site,true);
 end if;
 if site is null then raise exception 'site_unavailable' using errcode='42501'; end if;
 -- Same site serializes approval, withdrawal, revocation and invite changes.
 perform pg_advisory_xact_lock(hashtextextended('membership-site:'||site::text,0));
 select s.phase into phase from public.platform_sites s where s.id=site and s.organization_id is not null for update;
 if phase is null then raise exception 'site_unavailable' using errcode='42501'; end if;
 select * into cached from platform_private.membership_commands where actor_id=actor and request_id=p_request_id;
 if found then
  if cached.action<>p_action or cached.payload_digest<>fingerprint then raise exception 'idempotency_conflict'; end if;
  return cached.result||case when p_action='issue_invite' then '{"code":null,"replayed":true}'::jsonb else '{}'::jsonb end;
 end if;
 decision_reason:=btrim(coalesce(p_payload->>'reason',''));
 if length(decision_reason)>500 then raise exception 'invalid_reason'; end if;
 if p_action in ('review','revoke_member') and length(decision_reason)<5 then raise exception 'reason_required'; end if;

 if p_action in ('create_building','create_unit','set_building_active','set_unit_active','residence_policy','link_member_unit') then
  result:=platform_private.residence_change(actor,site,p_action,p_payload);
  subject:=(result->>'id')::uuid; target:=(result->>'user_id')::uuid;
 elsif p_action='profile' then
  select * into profile from platform_private.membership_site_profiles where site_id=site for update;
  if coalesce(profile.revision,0) is distinct from (p_payload->>'expected_revision')::integer then raise exception 'version_conflict'; end if;
  if length(coalesce(p_payload->>'address',''))>300 or length(coalesce(p_payload->>'office_phone',''))>30 or length(coalesce(p_payload->>'service_hours',''))>120 then raise exception 'invalid_profile'; end if;
  rev:=coalesce(profile.revision,0)+1;
  insert into platform_private.membership_site_profiles(site_id,address,office_phone,service_hours,revision,updated_by)
  values(site,btrim(coalesce(p_payload->>'address','')),btrim(coalesce(p_payload->>'office_phone','')),btrim(coalesce(p_payload->>'service_hours','')),rev,actor)
  on conflict(site_id) do update set address=excluded.address,office_phone=excluded.office_phone,service_hours=excluded.service_hours,revision=excluded.revision,updated_by=actor,updated_at=clock_timestamp();
  subject:=site; result:=jsonb_build_object('id',site,'revision',rev);
 elsif p_action='issue_invite' then
  if phase not in ('sandbox','site_acceptance','ready') then raise exception 'site_not_open'; end if;
  if (p_payload->>'days')::integer not between 1 and 7 or (p_payload->>'max_uses')::integer not between 1 and 100 or p_payload->>'days' is null or p_payload->>'max_uses' is null then raise exception 'invalid_invite'; end if;
  if (select count(*) from platform_private.membership_invites where site_id=site and created_at>now()-interval '1 hour')>=20 then raise exception 'rate_limited'; end if;
  token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into platform_private.membership_invites(site_id,token_hash,expires_at,max_uses,created_by)
  values(site,encode(extensions.digest(token,'sha256'),'hex'),clock_timestamp()+make_interval(days=>(p_payload->>'days')::integer),(p_payload->>'max_uses')::integer,actor) returning id into subject;
  result:=jsonb_build_object('id',subject,'revision',1);
 elsif p_action='revoke_invite' then
  select * into invite from platform_private.membership_invites where id=(p_payload->>'id')::uuid and site_id=site for update;
  if invite.id is null then raise exception 'invite_unavailable'; end if;
  if invite.revision is distinct from (p_payload->>'expected_revision')::integer then raise exception 'version_conflict'; end if;
  if invite.revoked then raise exception 'invite_already_revoked'; end if;
  update platform_private.membership_invites set revoked=true,revision=revision+1 where id=invite.id;
  subject:=invite.id; result:=jsonb_build_object('id',subject,'revision',invite.revision+1);
 elsif p_action='apply' then
  select * into invite from platform_private.membership_invites where id=invite.id for update;
  if invite.revoked or invite.expires_at<=clock_timestamp() or invite.uses>=invite.max_uses then raise exception 'invite_unavailable'; end if;
  if phase not in ('sandbox','site_acceptance','ready') then raise exception 'site_not_open'; end if;
  unit_name:=btrim(coalesce(p_payload->>'unit_label',''));
  if length(unit_name) not between 1 and 80 then raise exception 'unit_required'; end if;
  if exists(select 1 from public.platform_site_members where site_id=site and user_id=actor and status='active') then raise exception 'already_member'; end if;
  if exists(select 1 from platform_private.membership_requests where site_id=site and user_id=actor and status='pending') then raise exception 'application_pending'; end if;
  if (select count(*) from platform_private.membership_requests where user_id=actor and created_at>now()-interval '1 hour')>=5 then raise exception 'rate_limited'; end if;
  insert into platform_private.membership_requests(site_id,user_id,invite_id,unit_label) values(site,actor,invite.id,unit_name) returning id into subject;
  insert into public.platform_site_members(site_id,user_id,unit_label,status) values(site,actor,unit_name,'pending')
  on conflict(site_id,user_id) do update set unit_label=excluded.unit_label,unit_id=null,status='pending',revision=platform_site_members.revision+1;
  update platform_private.membership_invites set uses=uses+1,revision=revision+1 where id=invite.id;
  result:=jsonb_build_object('id',subject,'revision',1);
 elsif p_action in ('review','withdraw') then
  select * into application from platform_private.membership_requests where id=(p_payload->>'id')::uuid and site_id=site for update;
  if application.id is null then raise exception 'application_unavailable'; end if;
  if p_action='withdraw' and application.user_id<>actor then raise exception 'application_unavailable' using errcode='42501'; end if;
  if application.revision is distinct from (p_payload->>'expected_revision')::integer then raise exception 'version_conflict'; end if;
  if application.status<>'pending' then raise exception 'application_closed'; end if;
  decision:=case when p_action='withdraw' then 'withdrawn' else p_payload->>'decision' end;
  if decision is null or decision not in ('approved','rejected','withdrawn') or (p_action='review' and decision='withdrawn') then raise exception 'invalid_decision'; end if;
  target:=application.user_id;
  if decision='approved' then
   if phase not in ('sandbox','site_acceptance','ready') then raise exception 'site_not_open'; end if;
   if target=actor then raise exception 'independent_approver_required' using errcode='42501'; end if;
   select mode into residence_mode from platform_private.site_residence_policies where site_id=site;
   selected_unit:=nullif(p_payload->>'unit_id','')::uuid;
   if coalesce(residence_mode,'free_text')='registered_unit' and selected_unit is null then raise exception 'registered_unit_required'; end if;
   if selected_unit is not null then
    select b.label||' '||u.label into canonical_label from platform_private.site_units u join platform_private.site_buildings b on b.site_id=u.site_id and b.id=u.building_id where u.id=selected_unit and u.site_id=site and u.active and b.active;
    if canonical_label is null then raise exception 'unit_unavailable'; end if;
   end if;
   if not exists(select 1 from public.sgp_users where id=target and is_verified and status='active' and phone_verified_at is not null) then raise exception 'phone_verification_required' using errcode='42501'; end if;
  end if;
  update platform_private.membership_requests set status=decision,unit_id=selected_unit,revision=revision+1,decided_at=clock_timestamp(),decided_by=actor,reason=decision_reason where id=application.id;
  update public.platform_site_members set status=case when decision='approved' then 'active' else 'revoked' end,unit_id=selected_unit,unit_label=coalesce(canonical_label,unit_label),revision=revision+1 where site_id=site and user_id=target and status='pending';
  if not found then raise exception 'membership_state_conflict'; end if;
  subject:=application.id; result:=jsonb_build_object('id',subject,'revision',application.revision+1);
 else
  target:=(p_payload->>'user_id')::uuid;
  select * into member from public.platform_site_members where site_id=site and user_id=target for update;
  if member.user_id is null then raise exception 'member_unavailable'; end if;
  if member.revision is distinct from (p_payload->>'expected_revision')::integer then raise exception 'version_conflict'; end if;
  if member.status<>'active' then raise exception 'active_member_required'; end if;
  update public.platform_site_members set status='revoked',revision=revision+1 where site_id=site and user_id=target;
  update public.platform_resident_vehicles set status='revoked' where site_id=site and user_id=target and status<>'revoked';
  subject:=target; result:=jsonb_build_object('id',subject,'revision',member.revision+1);
 end if;
 insert into platform_private.membership_events(site_id,user_id,actor_id,action,subject_id,reason) values(site,target,actor,p_action,subject,decision_reason);
 insert into platform_private.audit_events(actor_id,subject_id,action,details) values(actor,site,'membership.'||p_action,jsonb_build_object('subject_id',subject,'user_id',target));
 insert into platform_private.membership_commands(actor_id,request_id,action,payload_digest,result) values(actor,p_request_id,p_action,fingerprint,result);
 return result||case when p_action='issue_invite' then jsonb_build_object('code',token,'replayed',false) else '{}'::jsonb end;
end $$;

create or replace function public.platform_membership_snapshot(p_site_id uuid,p_kind text default 'requests',p_status text default 'all',p_after uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; page jsonb; profile jsonb; manageable boolean;
begin
 perform platform_private.assert_site_access(p_site_id);
 if p_kind not in ('requests','members','invites','history') or p_kind is null or p_status is null or p_status not in ('all','pending','active','revoked','approved','rejected','withdrawn') then raise exception 'invalid_filter'; end if;
 manageable:=platform_private.is_headquarters() or exists(select 1 from platform_private.site_staff where site_id=p_site_id and user_id=auth.uid() and active and valid_until>statement_timestamp() and role='manager');
 if p_kind='requests' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into rows from (
   select r.id,r.user_id,coalesce(u.display_name,'회원') as display_name,r.unit_label,r.unit_id,r.status,r.revision,r.reason,r.created_at,r.decided_at,
   coalesce(u.is_verified and u.status='active' and u.phone_verified_at is not null,false) as phone_verified
   from platform_private.membership_requests r left join public.sgp_users u on u.id=r.user_id
   where r.site_id=p_site_id and (p_status='all' or r.status=p_status) and (p_after is null or r.id>p_after) order by r.id limit 51
  )x;
 elsif p_kind='members' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into rows from (
   select m.user_id as id,m.user_id,coalesce(u.display_name,'회원') as display_name,m.unit_label,m.unit_id,m.status,m.revision,
   coalesce(u.is_verified and u.status='active' and u.phone_verified_at is not null,false) as phone_verified
   from public.platform_site_members m left join public.sgp_users u on u.id=m.user_id
   where m.site_id=p_site_id and (p_status='all' or m.status=p_status) and (p_after is null or m.user_id>p_after) order by m.user_id limit 51
  )x;
 elsif p_kind='invites' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into rows from (
   select id,expires_at,max_uses,uses,revoked,revision,created_at from platform_private.membership_invites
   where site_id=p_site_id and (p_after is null or id>p_after) order by id limit 51
  )x;
 else
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into rows from (
   select id,user_id,actor_id,action,reason,created_at from platform_private.membership_events where site_id=p_site_id and (p_after is null or id>p_after) order by id limit 51
  )x;
 end if;
 select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into page from jsonb_array_elements(rows) with ordinality where ordinality<=50;
 select jsonb_build_object('revision',revision,'address',address,'office_phone',office_phone,'service_hours',service_hours) into profile from platform_private.membership_site_profiles where site_id=p_site_id;
 return jsonb_build_object('schema_version',1,'site',(select jsonb_build_object('id',id,'name',name,'phase',phase) from public.platform_sites where id=p_site_id),
  'residence_policy',coalesce((select jsonb_build_object('mode',mode,'revision',revision) from platform_private.site_residence_policies where site_id=p_site_id),'{"mode":"free_text","revision":0}'::jsonb),'can_manage',manageable,'profile',coalesce(profile,'{"revision":0,"address":"","office_phone":"","service_hours":""}'::jsonb),
  'counts',(select jsonb_build_object('pending',count(*) filter(where status='pending'),'active',count(*) filter(where status='active'),'revoked',count(*) filter(where status='revoked')) from public.platform_site_members where site_id=p_site_id),
  'kind',p_kind,'rows',page,'next_cursor',case when jsonb_array_length(rows)>50 then page->49->>'id' else null end,'observed_at',statement_timestamp());
end $$;

create or replace function public.platform_my_memberships() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 return jsonb_build_object('schema_version',1,'applications',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
  select r.id,r.site_id,s.name as site_name,s.phase,r.unit_label,r.unit_id,r.status,r.revision,r.reason,r.created_at from platform_private.membership_requests r join public.platform_sites s on s.id=r.site_id where r.user_id=auth.uid() order by r.created_at desc limit 30
 )x),'[]'::jsonb),'memberships',coalesce((select jsonb_agg(jsonb_build_object('site_id',s.id,'site_name',s.name,'phase',s.phase,'unit_label',m.unit_label,'unit_id',m.unit_id,'status',m.status)) from public.platform_site_members m join public.platform_sites s on s.id=m.site_id where m.user_id=auth.uid()),'[]'::jsonb),'observed_at',statement_timestamp());
end $$;


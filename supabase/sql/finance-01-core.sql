-- Finance v1: sandbox-only, no external provider, no real wallet access.
create schema finance_private;
revoke all on schema finance_private from public,anon,authenticated,service_role;
create table finance_private.control(id boolean primary key default true check(id), environment text not null default 'sandbox' check(environment='sandbox'), closed_through date);
insert into finance_private.control(id) values(true);
create table finance_private.facilities(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 2 and 120),kind text not null check(kind in ('residential','public_parking')),seller_name text not null check(length(seller_name) between 2 and 120),active boolean not null default true,created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create table finance_private.tariffs(id uuid primary key default gen_random_uuid(),facility_id uuid not null references finance_private.facilities(id),unit_minutes integer not null check(unit_minutes between 1 and 1440),unit_price bigint not null check(unit_price between 1 and 1000000),commission_bps integer not null check(commission_bps between 0 and 10000),created_at timestamptz not null default clock_timestamp(),created_by uuid not null references auth.users(id));
create index on finance_private.tariffs(facility_id,created_at desc);
create table finance_private.memberships(user_id uuid primary key references auth.users(id),facility_id uuid references finance_private.facilities(id));
create table finance_private.accounts(code text primary key,name text not null,erp_code text not null check(erp_code ~ '^[A-Za-z0-9_-]{1,40}$'));
insert into finance_private.accounts values ('cash','모의 현금자산','TEST_1000'),('wallet','시험 코인 예수부채','TEST_2100'),('facility','시설 미지급금 모형','TEST_2200'),('commission','본사 수수료 모형','TEST_4100');
create table finance_private.journals(id uuid primary key default gen_random_uuid(),number bigint generated always as identity unique,kind text not null,source_id uuid not null,entry_date date not null default (clock_timestamp() at time zone 'Asia/Seoul')::date,note text not null,actor uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),unique(kind,source_id));
create table finance_private.lines(journal_id uuid not null references finance_private.journals(id),line_no integer not null,account text not null references finance_private.accounts(code),owner_id uuid not null, debit bigint not null default 0 check(debit between 0 and 1000000000000),credit bigint not null default 0 check(credit between 0 and 1000000000000),primary key(journal_id,line_no),check((debit>0 and credit=0) or (credit>0 and debit=0)));
create index on finance_private.lines(account,owner_id);
create index on finance_private.journals(entry_date,number);
create table finance_private.requests(actor uuid not null references auth.users(id),request_id uuid not null,action text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor,request_id));
create index on finance_private.requests(created_at);
create function finance_private.authorize() returns uuid language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='super_admin') then raise exception 'finance_mfa_headquarters_required' using errcode='42501'; end if;
 return auth.uid();
end $$;
create function finance_private.amount(v text,p_min bigint default 1,p_max bigint default 1000000000) returns bigint language plpgsql immutable set search_path='' as $$
declare n bigint;
begin
 if v is null or v !~ '^[0-9]{1,13}$' then raise exception 'finance_integer_required'; end if;
 n:=v::bigint; if n<p_min or n>p_max then raise exception 'finance_amount_range'; end if;return n;
end $$;
create function finance_private.immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'finance_immutable';end $$;
create trigger immutable_journals before update or delete on finance_private.journals for each row execute function finance_private.immutable();
create trigger immutable_lines before update or delete on finance_private.lines for each row execute function finance_private.immutable();
create trigger immutable_tariffs before update or delete on finance_private.tariffs for each row execute function finance_private.immutable();
create trigger immutable_requests before update or delete on finance_private.requests for each row execute function finance_private.immutable();
-- Deferred triggers fire after the RPC's definer context has ended.
create function finance_private.assert_balanced() returns trigger language plpgsql security definer set search_path='' as $$
declare jid uuid; n integer; d numeric;c numeric;
begin
 if tg_table_name='journals' then jid:=new.id;else jid:=new.journal_id;end if;
 select count(*),coalesce(sum(debit),0),coalesce(sum(credit),0) into n,d,c from finance_private.lines where journal_id=jid;
 if n<2 or d<>c then raise exception 'finance_unbalanced_journal'; end if;return null;
end $$;
create constraint trigger balanced_header after insert on finance_private.journals deferrable initially deferred for each row execute function finance_private.assert_balanced();
create constraint trigger balanced_lines after insert on finance_private.lines deferrable initially deferred for each row execute function finance_private.assert_balanced();
create function finance_private.balance(p_account text,p_owner uuid) returns bigint language sql stable set search_path='' as $$ select coalesce(sum(credit-debit),0)::bigint from finance_private.lines where account=p_account and owner_id=p_owner $$;
create function finance_private.line(p_account text,p_owner uuid,p_debit bigint,p_credit bigint) returns jsonb language sql immutable set search_path='' as $$ select jsonb_build_object('account',p_account,'owner_id',p_owner,'debit',p_debit,'credit',p_credit) $$;
create function finance_private.post(p_kind text,p_source uuid,p_note text,p_lines jsonb) returns uuid language plpgsql set search_path='' as $$
declare jid uuid; x jsonb; i integer:=0; d numeric:=0;c numeric:=0;dt date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
begin
 if dt<=(select closed_through from finance_private.control) then raise exception 'finance_period_closed'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 2 and 10 then raise exception 'finance_invalid_lines'; end if;
 for x in select * from jsonb_array_elements(p_lines) loop d:=d+(x->>'debit')::bigint;c:=c+(x->>'credit')::bigint;end loop;
 if d<>c or d<=0 then raise exception 'finance_unbalanced_journal'; end if;
 insert into finance_private.journals(kind,source_id,note,actor) values(p_kind,p_source,p_note,auth.uid()) returning id into jid;
 for x in select * from jsonb_array_elements(p_lines) loop
  i:=i+1;insert into finance_private.lines values(jid,i,x->>'account',(x->>'owner_id')::uuid,(x->>'debit')::bigint,(x->>'credit')::bigint);
 end loop;return jid;
end $$;
create function finance_private.core_command(a text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare id uuid;fid uuid;n bigint;jid uuid;z uuid:='00000000-0000-0000-0000-000000000000';
begin
 if a='facility_create' then
  insert into finance_private.facilities(name,kind,seller_name,created_by) values(btrim(p->>'name'),p->>'kind',btrim(p->>'seller_name'),auth.uid()) returning facilities.id into id;
  return jsonb_build_object('id',id);
 elsif a='tariff_create' then
  fid:=(p->>'facility_id')::uuid;
  insert into finance_private.tariffs(facility_id,unit_minutes,unit_price,commission_bps,created_by) values(fid,finance_private.amount(p->>'unit_minutes',1,1440),finance_private.amount(p->>'unit_price',1,1000000),finance_private.amount(p->>'commission_bps',0,10000),auth.uid()) returning tariffs.id into id;
  return jsonb_build_object('id',id);
 elsif a='membership_set' then
  fid:=nullif(p->>'facility_id','')::uuid;
  insert into finance_private.memberships(user_id,facility_id) values(auth.uid(),fid) on conflict(user_id) do update set facility_id=excluded.facility_id;
  return jsonb_build_object('facility_id',fid);
 elsif a='test_credit' then
  n:=finance_private.amount(p->>'amount',1,1000000);
  if finance_private.balance('wallet',auth.uid())+n>10000000 then raise exception 'finance_test_balance_limit'; end if;
  id:=gen_random_uuid();jid:=finance_private.post('test_credit',id,'시험 코인 발급 — 실제 결제 아님',jsonb_build_array(finance_private.line('cash',z,n,0),finance_private.line('wallet',auth.uid(),0,n)));
  return jsonb_build_object('id',id,'journal_id',jid,'balance',finance_private.balance('wallet',auth.uid())::text);
 end if;raise exception 'finance_unknown_action';
end $$;
create function finance_private.dispatch(a text,p jsonb) returns jsonb language sql set search_path='' as $$select finance_private.core_command(a,p)$$;
create function public.finance_command(p_environment text,p_request_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;old finance_private.requests;result jsonb;
begin
 v_actor:=finance_private.authorize();
 if p_environment is distinct from 'sandbox' then raise exception 'finance_live_not_available'; end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>8192 or p_action is null then raise exception 'finance_invalid_request'; end if;
 -- Deliberately serializes this low-volume sandbox ledger, including close/export.
 perform pg_advisory_xact_lock(78941031);
 select * into old from finance_private.requests r where r.actor=v_actor and r.request_id=p_request_id;
 if found then
  if old.action<>p_action or old.payload<>p_payload then raise exception 'finance_idempotency_conflict'; end if;
  return old.result;
 end if;
 if (select count(*) from finance_private.requests r where r.actor=v_actor and r.created_at>now()-interval '1 hour')>=300 then raise exception 'finance_rate_limited'; end if;
 result:=finance_private.dispatch(p_action,p_payload)||jsonb_build_object('environment','sandbox','request_id',p_request_id);
 insert into finance_private.requests values(v_actor,p_request_id,p_action,p_payload,result,clock_timestamp());
 return result;
end $$;
revoke all on function public.finance_command(text,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.finance_command(text,uuid,text,jsonb) to authenticated;
do $$declare r record;begin for r in select tablename from pg_tables where schemaname='finance_private' loop execute format('alter table finance_private.%I enable row level security',r.tablename);end loop;end$$;
revoke all on all tables in schema finance_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema finance_private from public,anon,authenticated,service_role;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;

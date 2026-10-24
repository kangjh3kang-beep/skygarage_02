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

create table finance_private.quotes(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),facility_id uuid not null references finance_private.facilities(id),tariff_id uuid not null references finance_private.tariffs(id),home_facility_id uuid references finance_private.facilities(id),relation text not null check(relation in ('home','away','unaffiliated')),minutes integer not null check(minutes between 1 and 10080),gross bigint not null check(gross>0),commission bigint not null check(commission>=0),net bigint not null check(net>=0),expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',created_at timestamptz not null default clock_timestamp(),check(gross=commission+net));
create table finance_private.payments(id uuid primary key default gen_random_uuid(),quote_id uuid unique not null references finance_private.quotes(id),user_id uuid not null references auth.users(id),facility_id uuid not null references finance_private.facilities(id),gross bigint not null check(gross>0),commission bigint not null check(commission>=0),net bigint not null check(net>=0),journal_id uuid not null unique references finance_private.journals(id),created_at timestamptz not null default clock_timestamp(),check(gross=commission+net));
create index on finance_private.payments(user_id,created_at desc);
create table finance_private.refunds(id uuid primary key default gen_random_uuid(),payment_id uuid not null references finance_private.payments(id),gross bigint not null check(gross>0),commission bigint not null check(commission>=0),net bigint not null check(net>=0),reason text not null check(length(reason) between 5 and 500),journal_id uuid not null unique references finance_private.journals(id),created_at timestamptz not null default clock_timestamp(),check(gross=commission+net));
create index on finance_private.refunds(payment_id);
create table finance_private.settlement_items(id uuid primary key default gen_random_uuid(),payment_id uuid not null references finance_private.payments(id),refund_id uuid unique references finance_private.refunds(id),facility_id uuid not null references finance_private.facilities(id),gross bigint not null,commission bigint not null,net bigint not null,created_at timestamptz not null default clock_timestamp(),check(gross=commission+net));
create unique index one_payment_item on finance_private.settlement_items(payment_id) where refund_id is null;
create index on finance_private.settlement_items(facility_id,created_at);
create table finance_private.batches(id uuid primary key default gen_random_uuid(),facility_id uuid not null references finance_private.facilities(id),through_date date not null,gross bigint not null,commission bigint not null,net bigint not null check(net>0),item_count integer not null check(item_count>0),status text not null default 'draft' check(status in ('draft','approved','payout_pending','payout_failed','simulated_paid','cancelled')),created_by uuid not null references auth.users(id),approved_by uuid references auth.users(id),created_at timestamptz not null default clock_timestamp(),check(gross=commission+net),check(approved_by is null or approved_by<>created_by));
create table finance_private.batch_items(item_id uuid primary key references finance_private.settlement_items(id),batch_id uuid not null references finance_private.batches(id));
create index on finance_private.batch_items(batch_id);
create table finance_private.payout_outbox(batch_id uuid primary key references finance_private.batches(id),provider_key uuid unique not null default gen_random_uuid(),attempts integer not null check(attempts between 1 and 5),status text not null check(status in ('pending','failed','simulated_succeeded')),updated_at timestamptz not null default clock_timestamp());
create table finance_private.payout_events(id uuid primary key default gen_random_uuid(),batch_id uuid not null references finance_private.batches(id),outcome text not null check(outcome in ('unknown','failed','succeeded')),receipt text not null check(receipt ~ '^SIM-[A-Za-z0-9_-]{3,100}$'),amount bigint not null,created_at timestamptz not null default clock_timestamp(),unique(receipt));
create index on finance_private.payout_events(batch_id);
do $$declare r text;begin foreach r in array array['quotes','payments','refunds','settlement_items','payout_events'] loop execute format('create trigger immutable_%1$s before update or delete on finance_private.%1$I for each row execute function finance_private.immutable()',r);end loop;end$$;
create function finance_private.payment_command(a text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare q finance_private.quotes;pay finance_private.payments;tar finance_private.tariffs;b finance_private.batches;outbox finance_private.payout_outbox;event finance_private.payout_events;fid uuid;hid uuid;v_id uuid;jid uuid;g bigint;c bigint;n bigint;oldg bigint;oldc bigint;mins integer;cnt integer;dt date;ls jsonb;z uuid:='00000000-0000-0000-0000-000000000000';
begin
 if a='quote' then
  fid:=(p->>'facility_id')::uuid;mins:=finance_private.amount(p->>'minutes',1,10080);
  if not exists(select 1 from finance_private.facilities where facilities.id=fid and active) then raise exception 'finance_facility_unavailable'; end if;
  select * into tar from finance_private.tariffs where facility_id=fid order by created_at desc,id desc limit 1;
  if tar.id is null then raise exception 'finance_tariff_required'; end if;
  select facility_id into hid from finance_private.memberships where user_id=auth.uid();
  g:=((mins::bigint+tar.unit_minutes-1)/tar.unit_minutes)*tar.unit_price;
  if g>1000000000 then raise exception 'finance_amount_range'; end if;
  c:=floor(g::numeric*tar.commission_bps/10000)::bigint;n:=g-c;
  insert into finance_private.quotes(user_id,facility_id,tariff_id,home_facility_id,relation,minutes,gross,commission,net) values(auth.uid(),fid,tar.id,hid,case when hid is null then 'unaffiliated' when hid=fid then 'home' else 'away' end,mins,g,c,n) returning * into q;
  return jsonb_build_object('id',q.id,'gross',g::text,'commission',c::text,'net',n::text,'relation',q.relation,'expires_at',q.expires_at);
 elsif a='pay' then
  select * into q from finance_private.quotes where quotes.id=(p->>'quote_id')::uuid;
  if q.id is null or q.user_id<>auth.uid() then raise exception 'finance_quote_unavailable'; end if;
  if exists(select 1 from finance_private.payments where quote_id=q.id) then raise exception 'finance_quote_consumed'; end if;
  if q.expires_at<=clock_timestamp() then raise exception 'finance_quote_expired'; end if;
  if not exists(select 1 from finance_private.facilities where facilities.id=q.facility_id and active) then raise exception 'finance_facility_unavailable'; end if;
  if finance_private.balance('wallet',auth.uid())<q.gross then raise exception 'finance_insufficient_balance'; end if;
  v_id:=gen_random_uuid();ls:=jsonb_build_array(finance_private.line('wallet',auth.uid(),q.gross,0));
  if q.commission>0 then ls:=ls||jsonb_build_array(finance_private.line('commission',z,0,q.commission));end if;
  if q.net>0 then ls:=ls||jsonb_build_array(finance_private.line('facility',q.facility_id,0,q.net));end if;
  jid:=finance_private.post('payment',v_id,'시험 주차시설 이용',ls);
  insert into finance_private.payments values(v_id,q.id,auth.uid(),q.facility_id,q.gross,q.commission,q.net,jid,clock_timestamp());
  insert into finance_private.settlement_items(payment_id,facility_id,gross,commission,net) values(v_id,q.facility_id,q.gross,q.commission,q.net);
  return jsonb_build_object('id',v_id,'journal_id',jid,'balance',finance_private.balance('wallet',auth.uid())::text);
 elsif a='refund' then
  select * into pay from finance_private.payments where payments.id=(p->>'payment_id')::uuid;
  if pay.id is null then raise exception 'finance_payment_required';end if;
  if exists(select 1 from finance_private.settlement_items si join finance_private.batch_items bi on bi.item_id=si.id join finance_private.batches bt on bt.id=bi.batch_id where si.payment_id=pay.id and bt.status not in ('cancelled','simulated_paid')) then raise exception 'finance_cancel_unpaid_batch_first';end if;
  g:=finance_private.amount(p->>'amount');
  select coalesce(sum(gross),0),coalesce(sum(commission),0) into oldg,oldc from finance_private.refunds where payment_id=pay.id;
  if g+oldg>pay.gross then raise exception 'finance_refund_exceeds_payment';end if;
  c:=floor(pay.commission::numeric*(oldg+g)/pay.gross)::bigint-oldc;n:=g-c;
  v_id:=gen_random_uuid();ls:=jsonb_build_array(finance_private.line('wallet',pay.user_id,0,g));
  if c>0 then ls:=ls||jsonb_build_array(finance_private.line('commission',z,c,0));end if;
  if n>0 then ls:=ls||jsonb_build_array(finance_private.line('facility',pay.facility_id,n,0));end if;
  jid:=finance_private.post('refund',v_id,'시험 이용취소: '||btrim(p->>'reason'),ls);
  insert into finance_private.refunds values(v_id,pay.id,g,c,n,btrim(p->>'reason'),jid,clock_timestamp());
  insert into finance_private.settlement_items(payment_id,refund_id,facility_id,gross,commission,net) values(pay.id,v_id,pay.facility_id,-g,-c,-n);
  return jsonb_build_object('id',v_id,'commission',c::text,'net',n::text,'journal_id',jid);
 elsif a='batch_create' then
  fid:=(p->>'facility_id')::uuid;dt:=(p->>'through_date')::date;
  if dt is null or dt>(clock_timestamp() at time zone 'Asia/Seoul')::date then raise exception 'finance_invalid_cutoff';end if;
  if exists(select 1 from finance_private.batches where facility_id=fid and status in ('draft','approved','payout_pending','payout_failed')) then raise exception 'finance_open_batch_exists';end if;
  select count(*),coalesce(sum(gross),0),coalesce(sum(commission),0),coalesce(sum(net),0) into cnt,g,c,n from finance_private.settlement_items si where si.facility_id=fid and (si.created_at at time zone 'Asia/Seoul')::date<=dt and not exists(select 1 from finance_private.batch_items bi where bi.item_id=si.id);
  if cnt=0 or n<=0 then raise exception 'finance_no_positive_settlement';end if;
  insert into finance_private.batches(facility_id,through_date,gross,commission,net,item_count,created_by) values(fid,dt,g,c,n,cnt,auth.uid()) returning batches.id into v_id;
  insert into finance_private.batch_items select si.id,v_id from finance_private.settlement_items si where si.facility_id=fid and (si.created_at at time zone 'Asia/Seoul')::date<=dt and not exists(select 1 from finance_private.batch_items bi where bi.item_id=si.id);
  return jsonb_build_object('id',v_id,'net',n::text,'count',cnt);
 elsif a in ('batch_approve','batch_cancel','payout_request','simulate_payout_result') then
  select * into b from finance_private.batches where batches.id=(p->>'batch_id')::uuid;
  if b.id is null then raise exception 'finance_batch_required';end if;
  if a='batch_approve' then
   if b.status<>'draft' then raise exception 'finance_invalid_transition';end if;
   if b.created_by=auth.uid() then raise exception 'finance_independent_approval_required';end if;
   update finance_private.batches set status='approved',approved_by=auth.uid() where batches.id=b.id;
  elsif a='batch_cancel' then
   if b.status not in ('draft','approved','payout_failed') then raise exception 'finance_invalid_transition';end if;
   update finance_private.batches set status='cancelled' where batches.id=b.id;
   delete from finance_private.batch_items where batch_id=b.id;
  elsif a='payout_request' then
   if b.status not in ('approved','payout_failed') then raise exception 'finance_invalid_transition';end if;
   if b.approved_by is null or b.created_by=auth.uid() then raise exception 'finance_independent_approval_required';end if;
   insert into finance_private.payout_outbox(batch_id,attempts,status) values(b.id,1,'pending') on conflict(batch_id) do update set attempts=finance_private.payout_outbox.attempts+1,status='pending',updated_at=clock_timestamp() returning * into outbox;
   update finance_private.batches set status='payout_pending' where batches.id=b.id;
  else
   select * into event from finance_private.payout_events where receipt=p->>'receipt';
   if found then
    if event.batch_id<>b.id or event.outcome is distinct from p->>'outcome' or event.amount<>finance_private.amount(p->>'amount') then raise exception 'finance_provider_event_conflict';end if;
    return jsonb_build_object('id',b.id,'status',b.status);
   end if;
   if b.status<>'payout_pending' then raise exception 'finance_invalid_transition';end if;
   if auth.uid()=b.created_by then raise exception 'finance_independent_approval_required';end if;
   n:=finance_private.amount(p->>'amount');
   if n<>b.net then raise exception 'finance_payout_amount_mismatch';end if;
   if p->>'outcome' not in ('unknown','failed','succeeded') or p->>'outcome' is null then raise exception 'finance_invalid_outcome';end if;
   insert into finance_private.payout_events(batch_id,outcome,receipt,amount) values(b.id,p->>'outcome',p->>'receipt',n);
   if p->>'outcome'='failed' then
    update finance_private.batches set status='payout_failed' where batches.id=b.id;update finance_private.payout_outbox set status='failed',updated_at=clock_timestamp() where batch_id=b.id;
   elsif p->>'outcome'='succeeded' then
    if -finance_private.balance('cash',z)<n then raise exception 'finance_insufficient_clearing_cash';end if;
    jid:=finance_private.post('simulated_payout',b.id,'모의 지급 결과 대사 — 실제 송금 아님',jsonb_build_array(finance_private.line('facility',b.facility_id,n,0),finance_private.line('cash',z,0,n)));
    update finance_private.batches set status='simulated_paid' where batches.id=b.id;update finance_private.payout_outbox set status='simulated_succeeded',updated_at=clock_timestamp() where batch_id=b.id;
   end if;
  end if;
  return jsonb_build_object('id',b.id,'status',(select status from finance_private.batches where batches.id=b.id));
 end if;raise exception 'finance_unknown_action';
end $$;
create or replace function finance_private.dispatch(a text,p jsonb) returns jsonb language plpgsql set search_path='' as $$begin
 if a in ('facility_create','tariff_create','membership_set','test_credit') then return finance_private.core_command(a,p);end if;
 return finance_private.payment_command(a,p);
end$$;
do $$declare r record;begin for r in select tablename from pg_tables where schemaname='finance_private' loop execute format('alter table finance_private.%I enable row level security',r.tablename);end loop;end$$;
revoke all on all tables in schema finance_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema finance_private from public,anon,authenticated,service_role;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;

create table finance_private.exports(id uuid primary key default gen_random_uuid(),from_date date not null,to_date date not null,payload jsonb not null,digest text not null check(digest ~ '^[a-f0-9]{64}$'),status text not null default 'prepared' check(status in ('prepared','simulated_accepted')),created_by uuid not null references auth.users(id),accepted_by uuid references auth.users(id),receipt text,created_at timestamptz not null default clock_timestamp(),check(from_date<=to_date),check(accepted_by is null or accepted_by<>created_by));
create table finance_private.export_journals(journal_id uuid primary key references finance_private.journals(id),export_id uuid not null references finance_private.exports(id));
create index on finance_private.export_journals(export_id);
create table finance_private.period_closures(id uuid primary key default gen_random_uuid(),through_date date not null unique,note text not null check(length(note) between 5 and 500),actor uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp());
create trigger immutable_export_journals before update or delete on finance_private.export_journals for each row execute function finance_private.immutable();
create trigger immutable_closures before update or delete on finance_private.period_closures for each row execute function finance_private.immutable();
create function finance_private.protect_export() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'finance_immutable';end if;
 if row(new.id,new.from_date,new.to_date,new.payload,new.digest,new.created_by,new.created_at) is distinct from row(old.id,old.from_date,old.to_date,old.payload,old.digest,old.created_by,old.created_at) or old.status<>'prepared' then raise exception 'finance_immutable';end if;return new;
end$$;
create trigger immutable_export_payload before update or delete on finance_private.exports for each row execute function finance_private.protect_export();
create function finance_private.reconcile() returns jsonb language plpgsql stable set search_path='' as $$
declare unbalanced integer;wallet_negative integer;payment_mismatch integer;refund_mismatch integer;facility_mismatch integer;
begin
 select count(*) into unbalanced from (select j.id from finance_private.journals j left join finance_private.lines l on l.journal_id=j.id group by j.id having count(l.line_no)<2 or sum(l.debit)<>sum(l.credit)) s;
 select count(*) into wallet_negative from (select owner_id from finance_private.lines where account='wallet' group by owner_id having sum(credit-debit)<0) s;
 select count(*) into payment_mismatch from finance_private.payments p where
  p.gross<>(select coalesce(sum(debit),0) from finance_private.lines l where l.journal_id=p.journal_id and l.account='wallet' and l.owner_id=p.user_id)
  or p.net<>(select coalesce(sum(credit),0) from finance_private.lines l where l.journal_id=p.journal_id and l.account='facility' and l.owner_id=p.facility_id)
  or p.commission<>(select coalesce(sum(credit),0) from finance_private.lines l where l.journal_id=p.journal_id and l.account='commission');
 select count(*) into refund_mismatch from finance_private.refunds r join finance_private.payments p on p.id=r.payment_id where
  r.gross<>(select coalesce(sum(credit),0) from finance_private.lines l where l.journal_id=r.journal_id and l.account='wallet' and l.owner_id=p.user_id)
  or r.net<>(select coalesce(sum(debit),0) from finance_private.lines l where l.journal_id=r.journal_id and l.account='facility' and l.owner_id=p.facility_id)
  or r.commission<>(select coalesce(sum(debit),0) from finance_private.lines l where l.journal_id=r.journal_id and l.account='commission');
 select count(*) into facility_mismatch from finance_private.facilities f where finance_private.balance('facility',f.id) is distinct from
  (select coalesce(sum(si.net),0) from finance_private.settlement_items si where si.facility_id=f.id)-(select coalesce(sum(b.net),0) from finance_private.batches b where b.facility_id=f.id and b.status='simulated_paid');
 return jsonb_build_object('balanced',unbalanced=0,'wallets_nonnegative',wallet_negative=0,'payments_match',payment_mismatch=0,'refunds_match',refund_mismatch=0,'facility_payables_match',facility_mismatch=0,'passed',unbalanced+wallet_negative+payment_mismatch+refund_mismatch+facility_mismatch=0,'external_bank_verified',false,'external_erp_verified',false);
end$$;
create function finance_private.accounting_command(a text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare v_id uuid;startdate date;enddate date;e finance_private.exports;payload jsonb;sha text;cnt integer;report jsonb;
begin
 if a='account_map' then
  if p->>'erp_code' is null or p->>'erp_code' !~ '^[A-Za-z0-9_-]{1,40}$' then raise exception 'finance_invalid_account_mapping';end if;
  update finance_private.accounts set erp_code=p->>'erp_code' where code=p->>'account';
  if not found then raise exception 'finance_account_required';end if;
  return jsonb_build_object('account',p->>'account','erp_code',p->>'erp_code');
 elsif a='export_prepare' then
  startdate:=(p->>'from_date')::date;enddate:=(p->>'to_date')::date;
  if startdate is null or enddate is null or startdate>enddate or enddate>(clock_timestamp() at time zone 'Asia/Seoul')::date then raise exception 'finance_invalid_period';end if;
  report:=finance_private.reconcile();if report->>'passed'<>'true' then raise exception 'finance_reconciliation_failed';end if;
  select count(*) into cnt from finance_private.journals j where j.entry_date between startdate and enddate and not exists(select 1 from finance_private.export_journals x where x.journal_id=j.id);
  if cnt=0 or cnt>2000 then raise exception 'finance_export_range';end if;
  v_id:=gen_random_uuid();
  select jsonb_build_object('schema_version',1,'format','doelv-journal-v1','environment','sandbox','export_id',v_id,'from_date',startdate,'to_date',enddate,'not_tax_invoice',true,'rows',jsonb_agg(jsonb_build_object('journal_id',j.id,'journal_number',j.number::text,'entry_date',j.entry_date,'source_kind',j.kind,'source_id',j.source_id,'line_no',l.line_no,'account',l.account,'erp_account',ac.erp_code,'owner_id',l.owner_id,'debit',l.debit::text,'credit',l.credit::text) order by j.number,l.line_no)) into payload from finance_private.journals j join finance_private.lines l on l.journal_id=j.id join finance_private.accounts ac on ac.code=l.account where j.entry_date between startdate and enddate and not exists(select 1 from finance_private.export_journals x where x.journal_id=j.id);
  sha:=encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex');
  insert into finance_private.exports(id,from_date,to_date,payload,digest,created_by) values(v_id,startdate,enddate,payload,sha,auth.uid());
  insert into finance_private.export_journals select j.id,v_id from finance_private.journals j where j.entry_date between startdate and enddate and not exists(select 1 from finance_private.export_journals x where x.journal_id=j.id);
  return jsonb_build_object('id',v_id,'digest',sha,'journal_count',cnt,'row_count',jsonb_array_length(payload->'rows'));
 elsif a='simulate_erp_ack' then
  select * into e from finance_private.exports where exports.id=(p->>'export_id')::uuid;
  if e.id is null or e.status<>'prepared' then raise exception 'finance_export_unavailable';end if;
  if e.created_by=auth.uid() then raise exception 'finance_independent_approval_required';end if;
  if p->>'digest' is distinct from e.digest or finance_private.amount(p->>'row_count')<>jsonb_array_length(e.payload->'rows') then raise exception 'finance_erp_ack_mismatch';end if;
  if p->>'receipt' is null or p->>'receipt' !~ '^SIM-[A-Za-z0-9_-]{3,100}$' then raise exception 'finance_simulated_receipt_required';end if;
  update finance_private.exports set status='simulated_accepted',accepted_by=auth.uid(),receipt=p->>'receipt' where exports.id=e.id;
  return jsonb_build_object('id',e.id,'status','simulated_accepted');
 elsif a='period_close' then
  enddate:=(p->>'through_date')::date;
  if enddate is null or enddate>(clock_timestamp() at time zone 'Asia/Seoul')::date or enddate<=(select closed_through from finance_private.control) then raise exception 'finance_invalid_period';end if;
  if exists(select 1 from finance_private.journals j left join finance_private.export_journals x on x.journal_id=j.id left join finance_private.exports ex on ex.id=x.export_id where j.entry_date<=enddate and (ex.id is null or ex.status<>'simulated_accepted')) then raise exception 'finance_unaccepted_exports';end if;
  if exists(select 1 from finance_private.batches where (created_at at time zone 'Asia/Seoul')::date<=enddate and status not in ('simulated_paid','cancelled')) then raise exception 'finance_open_batches';end if;
  report:=finance_private.reconcile();if report->>'passed'<>'true' then raise exception 'finance_reconciliation_failed';end if;
  insert into finance_private.period_closures(through_date,note,actor) values(enddate,btrim(p->>'note'),auth.uid()) returning id into v_id;
  update finance_private.control set closed_through=enddate;
  return jsonb_build_object('id',v_id,'closed_through',enddate);
 end if;raise exception 'finance_unknown_action';
end$$;
create or replace function finance_private.dispatch(a text,p jsonb) returns jsonb language plpgsql set search_path='' as $$begin
 if a in ('facility_create','tariff_create','membership_set','test_credit') then return finance_private.core_command(a,p);end if;
 if a in ('quote','pay','refund','batch_create','batch_approve','batch_cancel','payout_request','simulate_payout_result') then return finance_private.payment_command(a,p);end if;
 return finance_private.accounting_command(a,p);
end$$;
create function public.finance_snapshot(p_environment text default 'sandbox') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid;
begin
 v_actor:=finance_private.authorize();if p_environment is distinct from 'sandbox' then raise exception 'finance_live_not_available';end if;
 return jsonb_build_object('schema_version',1,'environment','sandbox','observed_at',now(),'actor',v_actor,'live_enabled',false,'closed_through',(select closed_through from finance_private.control),'wallet_balance',finance_private.balance('wallet',v_actor)::text,'home_facility_id',(select facility_id from finance_private.memberships where user_id=v_actor),
 'facilities',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('payable',finance_private.balance('facility',f.id)::text,'tariff',(select jsonb_build_object('id',t.id,'unit_minutes',t.unit_minutes,'unit_price',t.unit_price::text,'commission_bps',t.commission_bps) from finance_private.tariffs t where t.facility_id=f.id order by t.created_at desc,t.id desc limit 1))) from finance_private.facilities f),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(to_jsonb(s)) from (select p.id,p.user_id,p.facility_id,p.created_at,p.gross::text,p.commission::text,p.net::text,q.relation,(select coalesce(sum(r.gross),0)::text from finance_private.refunds r where r.payment_id=p.id) refunded from finance_private.payments p join finance_private.quotes q on q.id=p.quote_id order by p.created_at desc limit 200) s),'[]'::jsonb),
 'batches',coalesce((select jsonb_agg(to_jsonb(s)) from (select b.id,b.facility_id,b.through_date,b.gross::text,b.commission::text,b.net::text,b.item_count,b.status,b.created_by,b.approved_by,b.created_at,o.provider_key,o.attempts from finance_private.batches b left join finance_private.payout_outbox o on o.batch_id=b.id order by b.created_at desc limit 200) s),'[]'::jsonb),
 'accounts',(select jsonb_agg(to_jsonb(ac)||jsonb_build_object('debit',(select coalesce(sum(l.debit),0)::text from finance_private.lines l where l.account=ac.code),'credit',(select coalesce(sum(l.credit),0)::text from finance_private.lines l where l.account=ac.code))) from finance_private.accounts ac),
 'exports',coalesce((select jsonb_agg(to_jsonb(s)) from (select id,from_date,to_date,status,digest,created_by,accepted_by,created_at,jsonb_array_length(payload->'rows') row_count from finance_private.exports order by created_at desc limit 100) s),'[]'::jsonb),
 'counts',jsonb_build_object('payments',(select count(*) from finance_private.payments),'journals',(select count(*) from finance_private.journals),'exports',(select count(*) from finance_private.exports),'batches',(select count(*) from finance_private.batches)),
 'reconciliation',finance_private.reconcile());
end$$;
create function public.finance_export_get(p_export_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare e finance_private.exports;begin
 perform finance_private.authorize();select * into e from finance_private.exports where id=p_export_id;if e.id is null then raise exception 'finance_export_unavailable';end if;
 return jsonb_build_object('id',e.id,'environment','sandbox','payload',e.payload,'canonical_payload',e.payload::text,'digest',e.digest,'status',e.status);
end$$;
revoke all on function public.finance_snapshot(text),public.finance_export_get(uuid) from public,anon,authenticated,service_role;
grant execute on function public.finance_snapshot(text),public.finance_export_get(uuid) to authenticated;
do $$declare r record;begin for r in select tablename from pg_tables where schemaname='finance_private' loop execute format('alter table finance_private.%I enable row level security',r.tablename);end loop;end$$;
revoke all on all tables in schema finance_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema finance_private from public,anon,authenticated,service_role;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;

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

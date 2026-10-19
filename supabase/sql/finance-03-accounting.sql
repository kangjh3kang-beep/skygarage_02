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

create table erp_private.imports (
 id uuid primary key default gen_random_uuid(), book_id uuid not null references erp_private.books(id),
 export_id uuid not null unique references finance_private.exports(id), digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 row_count integer not null check(row_count>0), journal_count integer not null check(journal_count>0),
 status text not null default 'received' check(status in ('received','posted')),
 created_by uuid not null references auth.users(id), posted_by uuid references auth.users(id),
 created_at timestamptz not null default clock_timestamp(), posted_at timestamptz,
 check(status<>'posted' or (posted_by is not null and posted_by<>created_by and posted_at is not null))
);
alter table erp_private.vouchers add constraint voucher_import_fk foreign key(import_id) references erp_private.imports(id);
create index on erp_private.imports(book_id,status);
create table erp_private.provider_plans (
 book_id uuid not null references erp_private.books(id), kind text not null check(kind in ('payment','payout')),
 vendor_code text check(vendor_code ~ '^[a-z0-9_-]{2,40}$'), label text check(length(label) between 2 and 100),
 status text not null default 'unassigned' check(status in ('unassigned','planned')),
 live_enabled boolean not null default false check(not live_enabled),
 version bigint not null default 1, updated_at timestamptz not null default clock_timestamp(),
 primary key(book_id,kind), check((status='unassigned' and vendor_code is null and label is null) or (status='planned' and vendor_code is not null and label is not null))
);
insert into erp_private.provider_plans(book_id,kind) select b.id,k from erp_private.books b cross join unnest(array['payment','payout']) k;
alter table finance_private.exports drop constraint exports_status_check;
alter table finance_private.exports add constraint exports_status_check check(status in ('prepared','simulated_accepted','erp_posted'));
create or replace function finance_private.protect_export() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'finance_immutable'; end if;
 if row(new.id,new.from_date,new.to_date,new.payload,new.digest,new.created_by,new.created_at)
 is distinct from row(old.id,old.from_date,old.to_date,old.payload,old.digest,old.created_by,old.created_at)
 or old.status not in ('prepared','simulated_accepted') or new.status<>'erp_posted' then raise exception 'finance_immutable'; end if;
 return new;
end $$;
create function erp_private.protect_import() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'erp_source_immutable'; end if;
 if old.status<>'received' or new.status<>'posted' or
 row(new.id,new.book_id,new.export_id,new.digest,new.row_count,new.journal_count,new.created_by,new.created_at)
 is distinct from row(old.id,old.book_id,old.export_id,old.digest,old.row_count,old.journal_count,old.created_by,old.created_at)
 then raise exception 'erp_source_immutable'; end if;
 return new;
end $$;
create trigger protect_import before update or delete on erp_private.imports for each row execute function erp_private.protect_import();

create function erp_private.source_facility(jid uuid) returns uuid language sql stable set search_path='' as $$
 select case j.kind
 when 'payment' then (select facility_id from finance_private.payments where journal_id=j.id)
 when 'refund' then (select p.facility_id from finance_private.refunds r join finance_private.payments p on p.id=r.payment_id where r.journal_id=j.id)
 when 'simulated_payout' then (select facility_id from finance_private.batches where id=j.source_id)
 end from finance_private.journals j where j.id=jid
$$;
create function erp_private.import_matches(iid uuid) returns boolean language plpgsql stable set search_path='' as $$
declare i erp_private.imports; e finance_private.exports;
begin
 select * into i from erp_private.imports where id=iid;
 select * into e from finance_private.exports where id=i.export_id;
 if i.id is null or e.id is null or i.digest<>e.digest or e.digest<>encode(extensions.digest(convert_to(e.payload::text,'UTF8'),'sha256'),'hex') then return false; end if;
 if i.row_count<>jsonb_array_length(e.payload->'rows') or i.row_count<>(select count(*) from erp_private.lines l join erp_private.vouchers v on v.id=l.voucher_id where v.import_id=i.id)
 or i.journal_count<>(select count(*) from erp_private.vouchers where import_id=i.id) then return false; end if;
 if exists(select 1 from jsonb_array_elements(e.payload->'rows') x where not exists(
  select 1 from erp_private.vouchers v join erp_private.lines l on l.voucher_id=v.id
  join finance_private.journals j on j.id=v.source_journal_id join finance_private.lines fl on fl.journal_id=j.id and fl.line_no=l.line_no
  where v.import_id=i.id and v.book_id=i.book_id and v.source_export_id=e.id and v.source='finance'
   and v.source_journal_id=(x->>'journal_id')::uuid and v.entry_date=(x->>'entry_date')::date and v.entry_date=j.entry_date
   and j.number::text=x->>'journal_number' and j.kind=x->>'source_kind' and j.source_id=(x->>'source_id')::uuid
   and l.line_no=(x->>'line_no')::integer and l.account_code=x->>'erp_account' and l.source_owner_id=(x->>'owner_id')::uuid
   and l.debit=(x->>'debit')::bigint and l.credit=(x->>'credit')::bigint
   and fl.account=x->>'account' and fl.owner_id=l.source_owner_id and fl.debit=l.debit and fl.credit=l.credit
   and ((fl.account<>'facility' and l.party_id is null) or (fl.account='facility' and exists(select 1 from erp_private.parties pp where pp.id=l.party_id and pp.book_id=i.book_id and pp.facility_id=fl.owner_id)))
   and exists(select 1 from erp_private.cost_centers cc where cc.id=l.cost_center_id and cc.book_id=i.book_id and
    ((erp_private.source_facility(j.id) is null and cc.facility_id is null and cc.code='HQ') or cc.facility_id=erp_private.source_facility(j.id)))
 )) then return false; end if;
 if i.status='posted' and (e.status<>'erp_posted' or exists(select 1 from erp_private.vouchers where import_id=i.id and status<>'posted')) then return false; end if;
 if i.status='received' and exists(select 1 from erp_private.vouchers where import_id=i.id and status<>'draft') then return false; end if;
 return true;
end $$;
create function erp_private.receive_finance(eid uuid) returns jsonb language plpgsql set search_path='' as $$
declare b uuid; e finance_private.exports; imp erp_private.imports; j finance_private.journals;
 vid uuid; x jsonb; rows_by_journal jsonb; fid uuid; party uuid; center uuid; v_code text; expected_kind text; count_j integer; count_l integer;
begin
 select id into b from erp_private.books where finance_source;
 select * into e from finance_private.exports where id=eid;
 if e.id is null then raise exception 'erp_export_required'; end if;
 select * into imp from erp_private.imports where export_id=e.id;
 if found then
  if not erp_private.import_matches(imp.id) then raise exception 'erp_source_mismatch'; end if;
  return jsonb_build_object('id',imp.id,'status',imp.status);
 end if;
 if e.status='erp_posted' or e.payload->>'environment' is distinct from 'sandbox' or e.payload->>'format' is distinct from 'doelv-journal-v1'
 or e.payload->>'schema_version' is distinct from '1' or e.payload->>'not_tax_invoice' is distinct from 'true'
 or e.payload->>'export_id' is distinct from e.id::text or jsonb_typeof(e.payload->'rows') is distinct from 'array'
 or e.digest<>encode(extensions.digest(convert_to(e.payload::text,'UTF8'),'sha256'),'hex') then raise exception 'erp_source_mismatch'; end if;
 select count(*) into count_j from finance_private.export_journals where export_id=e.id;
 select count(*) into count_l from finance_private.lines l join finance_private.export_journals x on x.journal_id=l.journal_id where x.export_id=e.id;
 if count_j<1 or count_j>2000 or count_l<>jsonb_array_length(e.payload->'rows') then raise exception 'erp_source_mismatch'; end if;
 select jsonb_object_agg(jid,rows) into rows_by_journal from (
  select value->>'journal_id' jid,jsonb_agg(value) rows from jsonb_array_elements(e.payload->'rows') group by value->>'journal_id'
 ) grouped;
 insert into erp_private.imports(book_id,export_id,digest,row_count,journal_count,created_by)
 values(b,e.id,e.digest,count_l,count_j,e.created_by) returning * into imp;
 for j in select fj.* from finance_private.journals fj join finance_private.export_journals ej on ej.journal_id=fj.id where ej.export_id=e.id order by fj.number loop
  perform erp_private.open_date(b,j.entry_date);
  fid:=null; party:=null;
  if j.kind='payment' then select facility_id into fid from finance_private.payments where journal_id=j.id;
  elsif j.kind='refund' then select p.facility_id into fid from finance_private.refunds r join finance_private.payments p on p.id=r.payment_id where r.journal_id=j.id;
  elsif j.kind='simulated_payout' then select facility_id into fid from finance_private.batches where id=j.source_id;
  elsif j.kind<>'test_credit' then raise exception 'erp_unsupported_source'; end if;
  if j.kind<>'test_credit' and fid is null then raise exception 'erp_source_mismatch'; end if;
  if fid is not null then
   insert into erp_private.parties(book_id,code,name,kind,facility_id) select b,'F_'||id,seller_name,'facility',id from finance_private.facilities where id=fid on conflict(book_id,facility_id) do nothing;
   insert into erp_private.cost_centers(book_id,code,name,facility_id) select b,'F_'||id,name,id from finance_private.facilities where id=fid on conflict(book_id,facility_id) do nothing;
   select id into party from erp_private.parties where book_id=b and facility_id=fid;
   select id into center from erp_private.cost_centers where book_id=b and facility_id=fid;
  else select id into center from erp_private.cost_centers where book_id=b and code='HQ'; end if;
  insert into erp_private.vouchers(book_id,entry_date,note,evidence_ref,source,source_journal_id,source_export_id,import_id,created_by)
  values(b,j.entry_date,'결제 원장: '||j.note,'FINANCE:'||j.id,'finance',j.id,e.id,imp.id,e.created_by) returning id into vid;
  for x in select value from jsonb_array_elements(rows_by_journal->j.id::text) loop
   v_code:=x->>'erp_account'; expected_kind:=case x->>'account' when 'cash' then 'asset' when 'wallet' then 'liability' when 'facility' then 'liability' when 'commission' then 'income' end;
   if expected_kind is null or not exists(select 1 from erp_private.accounts where book_id=b and accounts.code=v_code and kind=expected_kind) then raise exception 'erp_account_mapping_required'; end if;
   insert into erp_private.lines(voucher_id,book_id,line_no,account_code,party_id,cost_center_id,source_owner_id,debit,credit)
   values(vid,b,(x->>'line_no')::integer,v_code,case when x->>'account'='facility' then party else null end,center,(x->>'owner_id')::uuid,
    finance_private.amount(x->>'debit',0,1000000000000),finance_private.amount(x->>'credit',0,1000000000000));
  end loop;
  perform erp_private.check_lines(vid);
 end loop;
 if not erp_private.import_matches(imp.id) then raise exception 'erp_source_mismatch'; end if;
 perform erp_private.audit(b,'finance_received',imp.id,jsonb_build_object('export_id',e.id,'digest',e.digest,'rows',count_l));
 return jsonb_build_object('id',imp.id,'status','received','row_count',count_l,'journal_count',count_j);
end $$;
create function erp_private.post_import(iid uuid,b uuid) returns jsonb language plpgsql set search_path='' as $$
declare i erp_private.imports; vid uuid;
begin
 select * into i from erp_private.imports where id=iid and book_id=b;
 if i.id is null then raise exception 'erp_import_required'; end if;
 if not erp_private.import_matches(i.id) then raise exception 'erp_source_mismatch'; end if;
 if i.status='posted' then return jsonb_build_object('id',i.id,'status','posted'); end if;
 if i.created_by=auth.uid() then raise exception 'erp_independent_approval_required'; end if;
 for vid in select id from erp_private.vouchers where import_id=i.id order by number loop perform erp_private.post_voucher(vid,i.id); end loop;
 update erp_private.imports set status='posted',posted_by=auth.uid(),posted_at=clock_timestamp() where id=i.id;
 update finance_private.exports set status='erp_posted',accepted_by=auth.uid(),receipt='OWN-ERP-'||i.id where id=i.export_id;
 if not erp_private.import_matches(i.id) then raise exception 'erp_source_mismatch'; end if;
 perform erp_private.audit(b,'finance_posted',i.id,jsonb_build_object('export_id',i.export_id,'digest',i.digest));
 return jsonb_build_object('id',i.id,'status','posted','source_export_id',i.export_id);
end $$;

alter function erp_private.reconcile(uuid) rename to ledger_reconcile;
create function erp_private.reconcile(b uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare connected boolean; missing bigint:=0; pending bigint:=0; mismatches bigint:=0;
begin
 select finance_source into connected from erp_private.books where id=b;
 if connected then
  select count(*) into missing from finance_private.journals j where not exists(select 1 from finance_private.export_journals x where x.journal_id=j.id);
  select count(*) into pending from finance_private.exports e where not exists(select 1 from erp_private.imports i where i.export_id=e.id and i.status='posted');
  select count(*) into mismatches from erp_private.imports i where i.book_id=b and not erp_private.import_matches(i.id);
 end if;
 return erp_private.ledger_reconcile(b)||jsonb_build_object('source_connected',connected,'source_unexported',missing,'source_unposted',pending,'source_mismatches',mismatches,
 'source_reconciled',missing+pending+mismatches=0,'external_bank_verified',false);
end $$;
alter function erp_private.close_book(uuid,date,text) rename to close_ledger;
create function erp_private.close_book(b uuid,dt date,note_text text) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;
begin
 if (select finance_source from erp_private.books where id=b) then
  if exists(select 1 from finance_private.journals j where j.entry_date<=dt and not exists(
   select 1 from erp_private.vouchers v join erp_private.imports i on i.id=v.import_id
   where v.source_journal_id=j.id and v.book_id=b and v.status='posted' and i.status='posted'
  )) then raise exception 'erp_pending_source'; end if;
  if exists(select 1 from erp_private.imports i where i.book_id=b and exists(select 1 from erp_private.vouchers v where v.import_id=i.id and v.entry_date<=dt) and not erp_private.import_matches(i.id)) then raise exception 'erp_source_mismatch'; end if;
  if exists(select 1 from finance_private.batches where (created_at at time zone 'Asia/Seoul')::date<=dt and status not in ('simulated_paid','cancelled')) then raise exception 'finance_open_batches'; end if;
  if finance_private.reconcile()->>'passed'<>'true' then raise exception 'erp_source_mismatch'; end if;
 end if;
 result:=erp_private.close_ledger(b,dt,note_text);
 if (select finance_source from erp_private.books where id=b) then
  -- Preserve older source close records; never move its lock backwards or reopen it.
  if (select closed_through from finance_private.control) is null or dt>(select closed_through from finance_private.control) then
   insert into finance_private.period_closures(through_date,note,actor) values(dt,btrim(note_text),auth.uid());
   update finance_private.control set closed_through=dt;
  end if;
 end if;
 return result;
end $$;

alter function erp_private.command(text,jsonb) rename to ledger_command;
create function erp_private.command(a text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare b uuid; result jsonb;
begin
 b:=(p->>'book_id')::uuid;
 if a='finance_sync' then
  if b is distinct from (select id from erp_private.books where finance_source) then raise exception 'erp_book_required'; end if;
  return finance_private.accounting_command('export_prepare',jsonb_build_object('from_date',p->>'from_date','to_date',p->>'to_date'));
 elsif a='finance_receive' then
  if b is distinct from (select id from erp_private.books where finance_source) then raise exception 'erp_book_required'; end if;
  return erp_private.receive_finance((p->>'export_id')::uuid);
 elsif a='import_post' then return erp_private.post_import((p->>'import_id')::uuid,b);
 elsif a='provider_plan' then
  -- Metadata only. No keys, URLs, activation, or monetary execution are accepted.
  if not (p ?& array['book_id','kind','vendor_code','label']) or (p - array['book_id','kind','vendor_code','label'])<>'{}'::jsonb then raise exception 'erp_invalid_provider_plan'; end if;
  update erp_private.provider_plans set vendor_code=nullif(p->>'vendor_code',''),label=nullif(btrim(p->>'label'),''),
   status=case when nullif(p->>'vendor_code','') is null then 'unassigned' else 'planned' end,version=version+1,updated_at=clock_timestamp()
   where book_id=b and kind=p->>'kind';
  if not found then raise exception 'erp_invalid_provider_plan'; end if;
  perform erp_private.audit(b,a,null,p); return jsonb_build_object('status','not_connected','live_enabled',false);
 end if;
 result:=erp_private.ledger_command(a,p);
 if a='book_create' then insert into erp_private.provider_plans(book_id,kind) select (result->>'id')::uuid,k from unnest(array['payment','payout']) k; end if;
 return result;
end $$;
alter function finance_private.accounting_command(text,jsonb) rename to accounting_command_v1;
create function finance_private.accounting_command(a text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; received jsonb; b uuid; expected_kind text;
begin
 select id into b from erp_private.books where finance_source;
 if a='simulate_erp_ack' then raise exception 'erp_real_internal_posting_required';
 elsif a='period_close' then return erp_private.close_book(b,(p->>'through_date')::date,p->>'note');
 elsif a='account_map' then
  expected_kind:=case p->>'account' when 'cash' then 'asset' when 'wallet' then 'liability' when 'facility' then 'liability' when 'commission' then 'income' end;
  if not exists(select 1 from erp_private.accounts where book_id=b and code=p->>'erp_code' and kind=expected_kind) then raise exception 'erp_account_mapping_required'; end if;
 end if;
 result:=finance_private.accounting_command_v1(a,p);
 if a='export_prepare' then
  received:=erp_private.receive_finance((result->>'id')::uuid);
  result:=result||jsonb_build_object('erp_import_id',received->>'id','erp_status',received->>'status');
 end if;
 return result;
end $$;

alter function public.erp_snapshot(uuid) set schema erp_private;
alter function erp_private.erp_snapshot(uuid) rename to snapshot_core;
create function public.erp_snapshot(p_book_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; b uuid;
begin
 perform finance_private.authorize(); result:=erp_private.snapshot_core(p_book_id); b:=(result->'book'->>'id')::uuid;
 return result||jsonb_build_object(
 'imports',coalesce((select jsonb_agg(to_jsonb(x) order by (status='received') desc,created_at) from (select id,export_id,digest,row_count,journal_count,status,created_by,posted_by,created_at from erp_private.imports where book_id=b order by (status='received') desc,created_at limit 100)x),'[]'::jsonb),
 'import_count',(select count(*) from erp_private.imports where book_id=b),
 'pending_exports',coalesce((select jsonb_agg(to_jsonb(x)) from (select e.id,e.from_date,e.to_date,e.status from finance_private.exports e where (select finance_source from erp_private.books where id=b) and not exists(select 1 from erp_private.imports i where i.export_id=e.id) order by e.created_at limit 100)x),'[]'::jsonb),
 'providers',(select jsonb_agg(to_jsonb(x)||jsonb_build_object('version',x.version::text) order by kind) from erp_private.provider_plans x where book_id=b));
end $$;
revoke all on function public.erp_snapshot(uuid) from public,anon,authenticated,service_role;
grant execute on function public.erp_snapshot(uuid) to authenticated;
do $$declare r record;begin for r in select tablename from pg_tables where schemaname='erp_private' loop execute format('alter table erp_private.%I enable row level security',r.tablename);end loop;end$$;
revoke all on all tables in schema erp_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema erp_private from public,anon,authenticated,service_role;
revoke all on all functions in schema erp_private from public,anon,authenticated,service_role;
revoke all on all functions in schema finance_private from public,anon,authenticated,service_role;

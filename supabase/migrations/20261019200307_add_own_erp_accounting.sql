-- Own ERP v1. Durable double-entry books; the connected finance source is sandbox.
create schema erp_private;
revoke all on schema erp_private from public, anon, authenticated, service_role;

create table erp_private.books (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[A-Z0-9_-]{2,40}$'),
 name text not null check(length(name) between 2 and 120),
 environment text not null default 'sandbox' check(environment='sandbox'),
 currency text not null default 'KRW' check(currency='KRW'),
 finance_source boolean not null default false,
 closed_through date,
 created_at timestamptz not null default clock_timestamp()
);
create unique index one_finance_book on erp_private.books(finance_source) where finance_source;
create table erp_private.accounts (
 book_id uuid not null references erp_private.books(id),
 code text not null check(code ~ '^[A-Za-z0-9_-]{1,40}$'),
 name text not null check(length(name) between 2 and 100),
 kind text not null check(kind in ('asset','liability','equity','income','expense')),
 requires_party boolean not null default false,
 primary key(book_id,code)
);
create table erp_private.parties (
 id uuid primary key default gen_random_uuid(), book_id uuid not null references erp_private.books(id),
 code text not null check(code ~ '^[A-Za-z0-9_-]{1,50}$'), name text not null check(length(name) between 2 and 120),
 kind text not null check(kind in ('facility','customer','supplier','other')),
 facility_id uuid references finance_private.facilities(id),
 unique(book_id,code), unique(id,book_id), unique(book_id,facility_id)
);
create table erp_private.cost_centers (
 id uuid primary key default gen_random_uuid(), book_id uuid not null references erp_private.books(id),
 code text not null check(code ~ '^[A-Za-z0-9_-]{1,50}$'), name text not null check(length(name) between 2 and 120),
 facility_id uuid references finance_private.facilities(id),
 unique(book_id,code), unique(id,book_id), unique(book_id,facility_id)
);
create table erp_private.vouchers (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity unique,
 book_id uuid not null references erp_private.books(id), entry_date date not null,
 note text not null check(length(note) between 5 and 500), evidence_ref text not null check(length(evidence_ref) between 3 and 200),
 source text not null check(source in ('manual','finance','reversal')),
 source_journal_id uuid references finance_private.journals(id), source_export_id uuid references finance_private.exports(id),
 import_id uuid, reversal_of uuid references erp_private.vouchers(id),
 status text not null default 'draft' check(status in ('draft','posted','void')),
 created_by uuid not null references auth.users(id), posted_by uuid references auth.users(id),
 created_at timestamptz not null default clock_timestamp(), posted_at timestamptz,
 unique(id,book_id), unique(book_id,source_journal_id),
 check(status<>'posted' or (posted_by is not null and posted_by<>created_by and posted_at is not null)),
 check((source='finance' and source_journal_id is not null and source_export_id is not null and import_id is not null and reversal_of is null)
    or (source='reversal' and reversal_of is not null and source_journal_id is null and source_export_id is null and import_id is null)
    or (source='manual' and reversal_of is null and source_journal_id is null and source_export_id is null and import_id is null))
);
create index on erp_private.vouchers(book_id,entry_date,number);
create index on erp_private.vouchers(import_id);
create unique index one_active_reversal on erp_private.vouchers(reversal_of) where reversal_of is not null and status<>'void';
create table erp_private.lines (
 voucher_id uuid not null, book_id uuid not null, line_no integer not null check(line_no between 1 and 100),
 account_code text not null, party_id uuid, cost_center_id uuid, source_owner_id uuid,
 debit bigint not null default 0 check(debit between 0 and 1000000000000),
 credit bigint not null default 0 check(credit between 0 and 1000000000000),
 primary key(voucher_id,line_no),
 foreign key(voucher_id,book_id) references erp_private.vouchers(id,book_id),
 foreign key(book_id,account_code) references erp_private.accounts(book_id,code),
 foreign key(party_id,book_id) references erp_private.parties(id,book_id),
 foreign key(cost_center_id,book_id) references erp_private.cost_centers(id,book_id),
 check((debit>0 and credit=0) or (credit>0 and debit=0))
);
create index on erp_private.lines(book_id,account_code);
create index on erp_private.lines(party_id);
create index on erp_private.lines(cost_center_id);
create table erp_private.events (
 id bigint generated always as identity primary key, book_id uuid references erp_private.books(id),
 actor uuid not null references auth.users(id), action text not null, object_id uuid, detail jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create table erp_private.requests (
 actor uuid not null references auth.users(id), request_id uuid not null,
 action text not null, payload jsonb not null, result jsonb not null,
 created_at timestamptz not null default clock_timestamp(), primary key(actor,request_id)
);
create index on erp_private.requests(actor,created_at);
create table erp_private.closures (
 id uuid primary key default gen_random_uuid(), book_id uuid not null references erp_private.books(id),
 through_date date not null, actor uuid not null references auth.users(id),
 note text not null check(length(note) between 5 and 500), report jsonb not null,
 created_at timestamptz not null default clock_timestamp(), unique(book_id,through_date)
);

create function erp_private.seed_book(p_book uuid) returns void language plpgsql set search_path='' as $$
begin
 insert into erp_private.accounts(book_id,code,name,kind,requires_party) values
 (p_book,'TEST_1000','현금 및 결제대기 자산','asset',false),
 (p_book,'TEST_1200','매출채권','asset',true),
 (p_book,'TEST_2100','이용자 코인 예수금','liability',false),
 (p_book,'TEST_2200','시설 미지급금','liability',true),
 (p_book,'TEST_3000','자본 및 기초잔액','equity',false),
 (p_book,'TEST_4100','본사 수수료 수익','income',false),
 (p_book,'TEST_5100','운영 비용','expense',false);
 insert into erp_private.cost_centers(book_id,code,name) values(p_book,'HQ','본사 공통');
end $$;
do $$ declare b uuid; begin
 -- A legacy simulated close is not an ERP posting. Allow historical import first.
 insert into erp_private.books(code,name,finance_source)
 values('DOELV_SANDBOX','DOELV 시험 회계',true) returning id into b;
 perform erp_private.seed_book(b);
end $$;

create function erp_private.audit(b uuid,a text,o uuid,d jsonb default '{}'::jsonb) returns void language sql set search_path='' as $$
 insert into erp_private.events(book_id,actor,action,object_id,detail) values(b,auth.uid(),a,o,d)
$$;
create function erp_private.protect_voucher() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.status<>'draft' then raise exception 'erp_posted_immutable'; end if;
 if row(new.id,new.number,new.book_id,new.source,new.source_journal_id,new.source_export_id,new.import_id,new.reversal_of,new.created_by,new.created_at)
 is distinct from row(old.id,old.number,old.book_id,old.source,old.source_journal_id,old.source_export_id,old.import_id,old.reversal_of,old.created_by,old.created_at)
 then raise exception 'erp_source_immutable'; end if;
 return new;
end $$;
create trigger protect_voucher before update or delete on erp_private.vouchers for each row execute function erp_private.protect_voucher();
create function erp_private.protect_line() returns trigger language plpgsql set search_path='' as $$
declare vid uuid;
begin
 if tg_op='INSERT' then vid:=new.voucher_id; else vid:=old.voucher_id; end if;
 if (select status from erp_private.vouchers where id=vid) is distinct from 'draft' then raise exception 'erp_posted_immutable'; end if;
 if tg_op='UPDATE' and row(new.voucher_id,new.book_id,new.line_no) is distinct from row(old.voucher_id,old.book_id,old.line_no) then raise exception 'erp_source_immutable'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger protect_line before insert or update or delete on erp_private.lines for each row execute function erp_private.protect_line();
create function erp_private.check_lines(vid uuid) returns void language plpgsql set search_path='' as $$
declare n integer; d numeric; c numeric;
begin
 select count(*),coalesce(sum(debit),0),coalesce(sum(credit),0) into n,d,c from erp_private.lines where voucher_id=vid;
 if n<2 or n>100 or d<>c or d<=0 then raise exception 'erp_unbalanced_voucher'; end if;
 if exists(select 1 from erp_private.lines l join erp_private.accounts a on a.book_id=l.book_id and a.code=l.account_code where l.voucher_id=vid and a.requires_party and l.party_id is null) then raise exception 'erp_party_required'; end if;
end $$;
-- Narrow deferred integrity check, not a callable API. RPC definer context ends before COMMIT.
create function erp_private.deferred_balance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select status from erp_private.vouchers where id=new.id)='posted' then perform erp_private.check_lines(new.id); end if;
 return null;
end $$;
create constraint trigger validate_posting after insert or update on erp_private.vouchers deferrable initially deferred for each row execute function erp_private.deferred_balance();
do $$declare n text;begin foreach n in array array['accounts','parties','cost_centers','events','requests','closures'] loop
 execute format('create trigger immutable_%1$s before update or delete on erp_private.%1$I for each row execute function finance_private.immutable()',n);
end loop;end$$;

create function erp_private.open_date(b uuid,dt date) returns void language plpgsql set search_path='' as $$
declare book erp_private.books;
begin
 select * into book from erp_private.books where id=b;
 if book.id is null then raise exception 'erp_book_required'; end if;
 if dt is null or dt<'2000-01-01'::date or dt>(clock_timestamp() at time zone 'Asia/Seoul')::date then raise exception 'erp_invalid_date'; end if;
 if dt<=book.closed_through then raise exception 'erp_period_closed'; end if;
end $$;
create function erp_private.post_voucher(vid uuid,p_import uuid default null) returns void language plpgsql set search_path='' as $$
declare v erp_private.vouchers;
begin
 select * into v from erp_private.vouchers where id=vid;
 if v.id is null or v.status<>'draft' then raise exception 'erp_draft_required'; end if;
 if v.created_by=auth.uid() then raise exception 'erp_independent_approval_required'; end if;
 if v.source='finance' and (p_import is null or p_import<>v.import_id) then raise exception 'erp_batch_approval_required'; end if;
 perform erp_private.open_date(v.book_id,v.entry_date);
 perform erp_private.check_lines(v.id);
 update erp_private.vouchers set status='posted',posted_by=auth.uid(),posted_at=clock_timestamp() where id=v.id;
 perform erp_private.audit(v.book_id,'voucher_posted',v.id);
end $$;
create function erp_private.reconcile(b uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('balanced',not exists(
 select v.id from erp_private.vouchers v left join erp_private.lines l on l.voucher_id=v.id
 where v.book_id=b and v.status='posted' group by v.id having count(l.line_no)<2 or coalesce(sum(l.debit),0)<>coalesce(sum(l.credit),0)),
 'draft_count',(select count(*) from erp_private.vouchers where book_id=b and status='draft'))
$$;
create function erp_private.close_book(b uuid,dt date,note_text text) returns jsonb language plpgsql set search_path='' as $$
declare r jsonb; cid uuid;
begin
 perform erp_private.open_date(b,dt);
 if exists(select 1 from erp_private.vouchers where book_id=b and status='draft' and entry_date<=dt) then raise exception 'erp_pending_vouchers'; end if;
 r:=erp_private.reconcile(b);
 if r->>'balanced'<>'true' then raise exception 'erp_reconciliation_failed'; end if;
 insert into erp_private.closures(book_id,through_date,actor,note,report) values(b,dt,auth.uid(),btrim(note_text),r) returning id into cid;
 update erp_private.books set closed_through=dt where id=b;
 perform erp_private.audit(b,'period_closed',cid,jsonb_build_object('through_date',dt));
 return jsonb_build_object('id',cid,'closed_through',dt);
end $$;
create function erp_private.command(a text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare b uuid; vid uuid; r jsonb; v erp_private.vouchers; x jsonb; i integer:=0; dt date;
begin
 b:=(p->>'book_id')::uuid;
 if a='book_create' then
  insert into erp_private.books(code,name) values(p->>'code',btrim(p->>'name')) returning id into b;
  perform erp_private.seed_book(b); perform erp_private.audit(b,a,b); return jsonb_build_object('id',b);
 end if;
 if not exists(select 1 from erp_private.books where id=b) then raise exception 'erp_book_required'; end if;
 if a='account_create' then
  insert into erp_private.accounts(book_id,code,name,kind,requires_party) values(b,p->>'code',btrim(p->>'name'),p->>'kind',coalesce((p->>'requires_party')::boolean,false));
 elsif a='party_create' then
  insert into erp_private.parties(book_id,code,name,kind) values(b,p->>'code',btrim(p->>'name'),p->>'kind') returning id into vid;
 elsif a='cost_center_create' then
  insert into erp_private.cost_centers(book_id,code,name) values(b,p->>'code',btrim(p->>'name')) returning id into vid;
 elsif a='voucher_save' then
  dt:=(p->>'entry_date')::date; perform erp_private.open_date(b,dt);
  vid:=nullif(p->>'voucher_id','')::uuid;
  if jsonb_typeof(p->'lines') is distinct from 'array' or jsonb_array_length(p->'lines') not between 2 and 100 then raise exception 'erp_invalid_lines'; end if;
  if vid is null then
   insert into erp_private.vouchers(book_id,entry_date,note,evidence_ref,source,created_by) values(b,dt,btrim(p->>'note'),btrim(p->>'evidence_ref'),'manual',auth.uid()) returning id into vid;
  else
   select * into v from erp_private.vouchers where id=vid and book_id=b;
   if v.id is null or v.status<>'draft' or v.source<>'manual' or v.created_by<>auth.uid() then raise exception 'erp_edit_denied'; end if;
   update erp_private.vouchers set entry_date=dt,note=btrim(p->>'note'),evidence_ref=btrim(p->>'evidence_ref') where id=vid;
   delete from erp_private.lines where voucher_id=vid;
  end if;
  for x in select * from jsonb_array_elements(p->'lines') loop
   i:=i+1;
   insert into erp_private.lines(voucher_id,book_id,line_no,account_code,party_id,cost_center_id,debit,credit)
   values(vid,b,i,x->>'account_code',nullif(x->>'party_id','')::uuid,nullif(x->>'cost_center_id','')::uuid,
    finance_private.amount(x->>'debit',0,1000000000000),finance_private.amount(x->>'credit',0,1000000000000));
  end loop;
  perform erp_private.check_lines(vid);
 elsif a in ('voucher_post','voucher_void','voucher_reverse') then
  vid:=(p->>'voucher_id')::uuid; select * into v from erp_private.vouchers where id=vid and book_id=b;
  if v.id is null then raise exception 'erp_voucher_required'; end if;
  if v.source='finance' then raise exception 'erp_source_correction_required'; end if;
  if a='voucher_post' then perform erp_private.post_voucher(vid);
  elsif a='voucher_void' then
   if v.status<>'draft' then raise exception 'erp_draft_required'; end if;
   if length(btrim(coalesce(p->>'reason','')))<5 then raise exception 'erp_reason_required'; end if;
   update erp_private.vouchers set status='void' where id=vid;
  else
   if v.status<>'posted' then raise exception 'erp_posted_required'; end if;
   dt:=(p->>'entry_date')::date; perform erp_private.open_date(b,dt);
   if dt<v.entry_date then raise exception 'erp_invalid_date'; end if;
   insert into erp_private.vouchers(book_id,entry_date,note,evidence_ref,source,reversal_of,created_by)
   values(b,dt,btrim(p->>'reason'),'REVERSAL:'||v.id,'reversal',v.id,auth.uid()) returning id into vid;
   insert into erp_private.lines(voucher_id,book_id,line_no,account_code,party_id,cost_center_id,source_owner_id,debit,credit)
   select vid,book_id,line_no,account_code,party_id,cost_center_id,source_owner_id,credit,debit from erp_private.lines where voucher_id=v.id;
  end if;
 elsif a='period_close' then return erp_private.close_book(b,(p->>'through_date')::date,p->>'note');
 else raise exception 'erp_unknown_action'; end if;
 perform erp_private.audit(b,a,vid,p - 'lines');
 r:=jsonb_build_object('id',vid,'book_id',b);
 return r;
end $$;
create function public.erp_command(p_environment text,p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor_id uuid; old erp_private.requests; result jsonb;
begin
 actor_id:=finance_private.authorize();
 if p_environment is distinct from 'sandbox' then raise exception 'erp_live_not_available'; end if;
 if p_request_id is null or p_action is null or jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>65536 then raise exception 'erp_invalid_request'; end if;
 -- Same ordering as finance: a low-volume sandbox ledger, not a throughput claim.
 perform pg_advisory_xact_lock(78941031);
 select * into old from erp_private.requests where actor=actor_id and request_id=p_request_id;
 if found then
  if old.action<>p_action or old.payload<>p_payload then raise exception 'erp_idempotency_conflict'; end if;
  return old.result;
 end if;
 if (select count(*) from erp_private.requests where actor=actor_id and created_at>now()-interval '1 hour')>=300 then raise exception 'erp_rate_limited'; end if;
 result:=erp_private.command(p_action,p_payload)||jsonb_build_object('environment','sandbox','request_id',p_request_id);
 insert into erp_private.requests(actor,request_id,action,payload,result) values(actor_id,p_request_id,p_action,p_payload,result);
 return result;
end $$;
create function public.erp_snapshot(p_book_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor_id uuid; b uuid;
begin
 actor_id:=finance_private.authorize(); b:=coalesce(p_book_id,(select id from erp_private.books where finance_source));
 if not exists(select 1 from erp_private.books where id=b) then raise exception 'erp_book_required'; end if;
 return jsonb_build_object('schema_version',1,'environment','sandbox','actor',actor_id,'observed_at',now(),
 'book',(select to_jsonb(x) from erp_private.books x where id=b),
 'books',(select jsonb_agg(to_jsonb(x) order by code) from erp_private.books x),
 'accounts',(select jsonb_agg(to_jsonb(x) order by code) from erp_private.accounts x where book_id=b),
 'parties',coalesce((select jsonb_agg(to_jsonb(x) order by name) from erp_private.parties x where book_id=b),'[]'::jsonb),
 'cost_centers',coalesce((select jsonb_agg(to_jsonb(x) order by name) from erp_private.cost_centers x where book_id=b),'[]'::jsonb),
 'vouchers',coalesce((select jsonb_agg(to_jsonb(x) order by (status='draft') desc,number::bigint desc) from (select id,number::text,entry_date,note,evidence_ref,source,status,created_by,posted_by,source_export_id,reversal_of from erp_private.vouchers where book_id=b order by (status='draft') desc,vouchers.number desc limit 100)x),'[]'::jsonb),
 'counts',jsonb_build_object('vouchers',(select count(*) from erp_private.vouchers where book_id=b),'posted',(select count(*) from erp_private.vouchers where book_id=b and status='posted'),'draft',(select count(*) from erp_private.vouchers where book_id=b and status='draft')),
 'audit',coalesce((select jsonb_agg(to_jsonb(x) order by id desc) from (select id::text,actor,action,object_id,detail,created_at from erp_private.events where book_id=b order by id desc limit 50)x),'[]'::jsonb),
 'reconciliation',erp_private.reconcile(b));
end $$;
create function public.erp_document(p_voucher_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v erp_private.vouchers;
begin
 perform finance_private.authorize(); select * into v from erp_private.vouchers where id=p_voucher_id;
 if v.id is null then raise exception 'erp_voucher_required'; end if;
 return jsonb_build_object('environment','sandbox','voucher',to_jsonb(v)||jsonb_build_object('number',v.number::text),
 'lines',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('debit',l.debit::text,'credit',l.credit::text) order by line_no) from erp_private.lines l where voucher_id=v.id),'[]'::jsonb));
end $$;
create function public.erp_report(p_book_id uuid,p_from date,p_to date,p_cost_center uuid default null,p_after bigint default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare trial jsonb; pl jsonb; bs jsonb; ledger jsonb; next_number text; party_totals jsonb;
begin
 perform finance_private.authorize();
 if not exists(select 1 from erp_private.books where id=p_book_id) then raise exception 'erp_book_required'; end if;
 if p_from is null or p_to is null or p_from>p_to or p_from<'2000-01-01' or p_to>(clock_timestamp() at time zone 'Asia/Seoul')::date or p_after is null or p_after<0 then raise exception 'erp_invalid_date'; end if;
 if p_cost_center is not null and not exists(select 1 from erp_private.cost_centers where id=p_cost_center and book_id=p_book_id) then raise exception 'erp_dimension_mismatch'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by code),'[]'::jsonb) into trial from (
  select a.code,a.name,a.kind,
   coalesce(sum(l.debit-l.credit) filter(where v.entry_date<p_from),0)::text opening,
   coalesce(sum(l.debit) filter(where v.entry_date>=p_from),0)::text debit,
   coalesce(sum(l.credit) filter(where v.entry_date>=p_from),0)::text credit,
   coalesce(sum(l.debit-l.credit),0)::text closing
  from erp_private.accounts a left join (
   erp_private.lines l join erp_private.vouchers v on v.id=l.voucher_id and v.status='posted' and v.entry_date<=p_to
  ) on l.book_id=a.book_id and l.account_code=a.code and (p_cost_center is null or l.cost_center_id=p_cost_center)
  where a.book_id=p_book_id group by a.code,a.name,a.kind
 )t;
 select jsonb_build_object('income',coalesce(sum((x->>'credit')::numeric-(x->>'debit')::numeric) filter(where x->>'kind'='income'),0)::text,
 'expense',coalesce(sum((x->>'debit')::numeric-(x->>'credit')::numeric) filter(where x->>'kind'='expense'),0)::text) into pl from jsonb_array_elements(trial)x;
 pl:=pl||jsonb_build_object('profit',((pl->>'income')::numeric-(pl->>'expense')::numeric)::text);
 select jsonb_build_object('assets',coalesce(sum((x->>'closing')::numeric) filter(where x->>'kind'='asset'),0)::text,
 'liabilities',(-coalesce(sum((x->>'closing')::numeric) filter(where x->>'kind'='liability'),0))::text,
 'equity',(-coalesce(sum((x->>'closing')::numeric) filter(where x->>'kind'='equity'),0))::text,
 'accumulated_result',(-coalesce(sum((x->>'closing')::numeric) filter(where x->>'kind' in ('income','expense')),0))::text,
 'difference',coalesce(sum((x->>'closing')::numeric),0)::text) into bs from jsonb_array_elements(trial)x;
 with page as (select v.* from erp_private.vouchers v where v.book_id=p_book_id and v.status='posted' and v.entry_date between p_from and p_to and v.number>p_after and
  (p_cost_center is null or exists(select 1 from erp_private.lines l where l.voucher_id=v.id and l.cost_center_id=p_cost_center)) order by number limit 100)
 select coalesce(jsonb_agg(jsonb_build_object('voucher_id',v.id,'number',v.number::text,'entry_date',v.entry_date,'note',v.note,'source',v.source,
 'line_no',l.line_no,'account_code',l.account_code,'party_id',l.party_id,'cost_center_id',l.cost_center_id,'debit',l.debit::text,'credit',l.credit::text) order by v.number,l.line_no),'[]'::jsonb),max(v.number)::text into ledger,next_number
 from page v join erp_private.lines l on l.voucher_id=v.id where p_cost_center is null or l.cost_center_id=p_cost_center;
 select coalesce(jsonb_agg(to_jsonb(t) order by name),'[]'::jsonb) into party_totals from (
  select p.id,p.name,p.kind,a.code account_code,a.name account_name,a.kind account_kind,sum(l.debit-l.credit)::text balance
  from erp_private.parties p join erp_private.lines l on l.party_id=p.id join erp_private.vouchers v on v.id=l.voucher_id and v.status='posted'
  join erp_private.accounts a on a.book_id=l.book_id and a.code=l.account_code
  where p.book_id=p_book_id and v.entry_date<=p_to and (p_cost_center is null or l.cost_center_id=p_cost_center)
  group by p.id,p.name,p.kind,a.code,a.name,a.kind)t;
 return jsonb_build_object('schema_version',1,'environment','sandbox','book_id',p_book_id,'from_date',p_from,'to_date',p_to,'cost_center_id',p_cost_center,
 'trial_balance',trial,'profit_loss',pl,'balance_sheet',bs,'party_balances',party_totals,'ledger',ledger,'next_after',next_number,
 'ledger_page_size',100,'aggregates_cover_all_posted_entries',true,'external_bank_verified',false,'statutory_report',false);
end $$;
revoke all on function public.erp_command(text,uuid,text,jsonb),public.erp_snapshot(uuid),public.erp_document(uuid),public.erp_report(uuid,date,date,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.erp_command(text,uuid,text,jsonb),public.erp_snapshot(uuid),public.erp_document(uuid),public.erp_report(uuid,date,date,uuid,bigint) to authenticated;
do $$declare r record;begin for r in select tablename from pg_tables where schemaname='erp_private' loop execute format('alter table erp_private.%I enable row level security',r.tablename);end loop;end$$;
revoke all on all tables in schema erp_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema erp_private from public,anon,authenticated,service_role;
revoke all on all functions in schema erp_private from public,anon,authenticated,service_role;

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

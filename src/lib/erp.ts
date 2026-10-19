export type ErpBook={id:string;code:string;name:string;environment:'sandbox';currency:'KRW';finance_source:boolean;closed_through:string|null};
export type ErpAccount={code:string;name:string;kind:'asset'|'liability'|'equity'|'income'|'expense';requires_party:boolean};
export type ErpParty={id:string;code:string;name:string;kind:string;facility_id:string|null};
export type ErpCenter={id:string;code:string;name:string;facility_id:string|null};
export type ErpVoucher={id:string;book_id?:string;number:string;entry_date:string;note:string;evidence_ref:string;source:'manual'|'finance'|'reversal';status:'draft'|'posted'|'void';created_by:string;posted_by:string|null;source_export_id:string|null;reversal_of:string|null};
export type ErpLine={line_no:number;account_code:string;party_id:string|null;cost_center_id:string|null;debit:string;credit:string};
export type ErpImport={id:string;export_id:string;digest:string;row_count:number;journal_count:number;status:'received'|'posted';created_by:string;posted_by:string|null;created_at:string};
export type ProviderPlan={kind:'payment'|'payout';vendor_code:string|null;label:string|null;status:'unassigned'|'planned';live_enabled:false;version:string};
export type ErpSnapshot={schema_version:1;environment:'sandbox';actor:string;book:ErpBook;books:ErpBook[];accounts:ErpAccount[];parties:ErpParty[];cost_centers:ErpCenter[];vouchers:ErpVoucher[];counts:{vouchers:number;posted:number;draft:number};imports:ErpImport[];import_count:number;pending_exports:{id:string;from_date:string;to_date:string;status:string}[];providers:ProviderPlan[];audit:{id:string;actor:string;action:string;object_id:string|null;created_at:string}[];reconciliation:{balanced:boolean;draft_count:number;source_connected:boolean;source_unexported:number;source_unposted:number;source_mismatches:number;source_reconciled:boolean;external_bank_verified:false}};
export type ErpReport={schema_version:1;environment:'sandbox';book_id:string;from_date:string;to_date:string;cost_center_id:string|null;trial_balance:{code:string;name:string;kind:string;opening:string;debit:string;credit:string;closing:string}[];profit_loss:{income:string;expense:string;profit:string};balance_sheet:{assets:string;liabilities:string;equity:string;accumulated_result:string;difference:string};party_balances:{id:string;name:string;kind:string;account_code:string;account_name:string;account_kind:string;balance:string}[];ledger:(ErpLine&{voucher_id:string;number:string;entry_date:string;note:string;source:string})[];next_after:string|null;aggregates_cover_all_posted_entries:true;external_bank_verified:false;statutory_report:false};
const object=(x:unknown):Record<string,unknown>=>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error('erp_invalid_response');return x as Record<string,unknown>;};
const check=(ok:unknown)=>{if(!ok)throw Error('erp_invalid_response');};
const list=(x:unknown)=>{check(Array.isArray(x));return (x as unknown[]).map(object);};
const uuid=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
const text=(x:unknown)=>typeof x==='string'&&x.length>0;
const money=(x:unknown)=>typeof x==='string'&&/^-?\d{1,30}$/.test(x);
const count=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0;
const date=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const voucher=(v:Record<string,unknown>)=>check(uuid(v.id)&&money(v.number)&&date(v.entry_date)&&text(v.note)&&text(v.evidence_ref)&&uuid(v.created_by)&&['draft','posted','void'].includes(String(v.status))&&['manual','finance','reversal'].includes(String(v.source))&&(v.status!=='posted'||uuid(v.posted_by)&&v.posted_by!==v.created_by));
function lines(raw:unknown){for(const l of list(raw)){check(count(l.line_no)&&text(l.account_code)&&money(l.debit)&&money(l.credit));const d=BigInt(String(l.debit)),c=BigInt(String(l.credit));check((d>0n&&c===0n)||(c>0n&&d===0n));}}
export function parseErpSnapshot(raw:unknown):ErpSnapshot{
 const v=object(raw);check(v.schema_version===1&&v.environment==='sandbox'&&uuid(v.actor));
 for(const b of [object(v.book),...list(v.books)])check(uuid(b.id)&&text(b.name)&&text(b.code)&&b.environment==='sandbox'&&b.currency==='KRW'&&typeof b.finance_source==='boolean'&&(b.closed_through===null||date(b.closed_through)));
 for(const a of list(v.accounts))check(text(a.code)&&text(a.name)&&['asset','liability','equity','income','expense'].includes(String(a.kind))&&typeof a.requires_party==='boolean');
 for(const p of [...list(v.parties),...list(v.cost_centers)])check(uuid(p.id)&&text(p.name)&&text(p.code));
 for(const x of list(v.vouchers))voucher(x);
 const c=object(v.counts);for(const k of ['vouchers','draft','posted'])check(count(c[k]));
 for(const i of list(v.imports))check(uuid(i.id)&&uuid(i.export_id)&&uuid(i.created_by)&&text(i.digest)&&/^[a-f0-9]{64}$/.test(String(i.digest))&&count(i.row_count)&&count(i.journal_count)&&['received','posted'].includes(String(i.status))&&(i.status!=='posted'||uuid(i.posted_by)&&i.posted_by!==i.created_by));
 check(count(v.import_count));for(const e of list(v.pending_exports))check(uuid(e.id)&&date(e.from_date)&&date(e.to_date));
 const providers=list(v.providers);check(providers.length===2&&new Set(providers.map(p=>p.kind)).size===2);
 for(const p of providers)check(['payment','payout'].includes(String(p.kind))&&p.live_enabled===false&&money(p.version)&&((p.status==='unassigned'&&p.vendor_code===null&&p.label===null)||(p.status==='planned'&&text(p.vendor_code)&&text(p.label))));
 for(const e of list(v.audit))check(money(e.id)&&uuid(e.actor)&&text(e.action)&&text(e.created_at));
 const r=object(v.reconciliation);check(typeof r.balanced==='boolean'&&typeof r.source_connected==='boolean'&&r.external_bank_verified===false);
 for(const k of ['draft_count','source_unexported','source_unposted','source_mismatches'])check(count(r[k]));
 check(r.source_reconciled===(Number(r.source_unexported)+Number(r.source_unposted)+Number(r.source_mismatches)===0));
 return raw as ErpSnapshot;
}
export function parseErpDocument(raw:unknown):{environment:'sandbox';voucher:ErpVoucher;lines:ErpLine[]}{
 const v=object(raw);check(v.environment==='sandbox');voucher(object(v.voucher));lines(v.lines);const ls=list(v.lines);check(ls.length>=2&&new Set(ls.map(l=>l.line_no)).size===ls.length&&ls.reduce((s,l)=>s+BigInt(String(l.debit))-BigInt(String(l.credit)),0n)===0n);return raw as {environment:'sandbox';voucher:ErpVoucher;lines:ErpLine[]};
}
export function parseErpReport(raw:unknown):ErpReport{
 const v=object(raw);check(v.schema_version===1&&v.environment==='sandbox'&&uuid(v.book_id)&&date(v.from_date)&&date(v.to_date)&&v.aggregates_cover_all_posted_entries===true&&v.external_bank_verified===false&&v.statutory_report===false);
 check(v.cost_center_id===null||uuid(v.cost_center_id));check(v.next_after===null||money(v.next_after));
 const tb=list(v.trial_balance);check(new Set(tb.map(t=>t.code)).size===tb.length);for(const t of tb){check(text(t.code)&&text(t.name)&&['asset','liability','equity','income','expense'].includes(String(t.kind))&&[t.opening,t.debit,t.credit,t.closing].every(money));check(BigInt(String(t.debit))>=0n&&BigInt(String(t.credit))>=0n&&BigInt(String(t.opening))+BigInt(String(t.debit))-BigInt(String(t.credit))===BigInt(String(t.closing)));}
 const pl=object(v.profit_loss),bs=object(v.balance_sheet);for(const k of ['income','expense','profit'])check(money(pl[k]));for(const k of ['assets','liabilities','equity','accumulated_result','difference'])check(money(bs[k]));
 check(BigInt(String(pl.income))-BigInt(String(pl.expense))===BigInt(String(pl.profit)));
 check(BigInt(String(bs.assets))-BigInt(String(bs.liabilities))-BigInt(String(bs.equity))-BigInt(String(bs.accumulated_result))===BigInt(String(bs.difference)));
 const total=(kind:string,field:string)=>tb.filter(t=>t.kind===kind).reduce((s,t)=>s+BigInt(String(t[field])),0n);
 check(BigInt(String(pl.income))===total('income','credit')-total('income','debit')&&BigInt(String(pl.expense))===total('expense','debit')-total('expense','credit'));
 check(BigInt(String(bs.assets))===total('asset','closing')&&BigInt(String(bs.liabilities))===-total('liability','closing')&&BigInt(String(bs.equity))===-total('equity','closing')&&BigInt(String(bs.accumulated_result))===-total('income','closing')-total('expense','closing'));
 if(v.cost_center_id===null)check(bs.difference==='0');
 lines(v.ledger);const seen=new Set<string>();for(const l of list(v.ledger)){check(uuid(l.voucher_id)&&money(l.number)&&date(l.entry_date));const k=`${l.voucher_id}:${l.line_no}`;check(!seen.has(k));seen.add(k);}
 for(const p of list(v.party_balances))check(uuid(p.id)&&text(p.name)&&text(p.account_code)&&money(p.balance));
 return raw as ErpReport;
}
export function erpCsv(rows:Record<string,unknown>[],keys:string[]):string{
 const cell=(x:unknown)=>{let s=String(x??'');if(/^\s*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n');
}
const errors:Record<string,string>={finance_export_range:'미전송 전표가 없거나 2,000개를 초과합니다. 조회 기간을 확인해 주세요.',finance_mfa_headquarters_required:'최고관리자 권한과 2단계 인증이 필요합니다.',erp_independent_approval_required:'작성자와 다른 관리자가 승인해야 합니다.',erp_unbalanced_voucher:'차변·대변 합계가 같고 0보다 커야 합니다.',erp_party_required:'거래처가 필요한 계정입니다. 해당 행의 거래처를 선택해 주세요.',erp_period_closed:'마감된 기간에는 전표를 입력할 수 없습니다.',erp_pending_vouchers:'승인하거나 취소해야 할 초안이 남아 있습니다.',erp_pending_source:'결제·정산 원장의 미전송 또는 미승인 전표가 남아 있습니다.',erp_source_mismatch:'원천 전표와 ERP 전표가 일치하지 않습니다. 반영을 중지했습니다.',erp_source_correction_required:'결제·정산에서 발생한 전표는 원거래의 환불·조정으로 정정해 주세요.',erp_account_mapping_required:'자체 ERP의 올바른 계정과목에 먼저 매핑해 주세요.',erp_draft_required:'승인 가능한 초안이 아닙니다. 다시 조회해 주세요.',erp_invalid_date:'전표 날짜 또는 조회 기간을 확인해 주세요.',erp_edit_denied:'작성한 수기 초안만 수정할 수 있습니다.',finance_open_batches:'진행 중인 현장 정산을 완료하거나 취소해야 합니다.'};
export function erpError(error:unknown){const message=error&&typeof error==='object'&&'message' in error?String(error.message):'';return Object.entries(errors).find(([key])=>message.includes(key))?.[1]??'처리 결과를 확인하지 못했습니다. 입력·권한·연결을 확인하고 재시도해 주세요. 같은 요청 번호를 사용합니다.';}

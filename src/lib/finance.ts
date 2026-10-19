export type Facility={id:string;name:string;kind:string;seller_name:string;payable:string;tariff:null|{id:string;unit_minutes:number;unit_price:string;commission_bps:number}};
export type Payment={id:string;user_id:string;facility_id:string;gross:string;commission:string;net:string;refunded:string;relation:string;created_at:string};
export type Batch={id:string;facility_id:string;net:string;gross:string;commission:string;status:string;created_by:string;approved_by:string|null;item_count:number;attempts:number|null};
export type FinanceExport={id:string;from_date:string;to_date:string;status:string;digest:string;created_by:string;row_count:number};
export type FinanceSnapshot={schema_version:1;environment:'sandbox';live_enabled:false;actor:string;observed_at:string;wallet_balance:string;home_facility_id:string|null;closed_through:string|null;facilities:Facility[];payments:Payment[];batches:Batch[];accounts:{code:string;name:string;erp_code:string;debit:string;credit:string}[];exports:FinanceExport[];counts:{payments:number;journals:number;batches:number;exports:number};reconciliation:{passed:boolean;balanced:boolean;wallets_nonnegative:boolean;payments_match:boolean;refunds_match:boolean;facility_payables_match:boolean;external_bank_verified:false;external_erp_verified:false}};
const fail=()=>{throw new Error('finance_invalid_response');};
const obj=(x:unknown):Record<string,unknown>=>{if(!x||typeof x!=='object'||Array.isArray(x))return fail();return x as Record<string,unknown>;};
const arr=(x:unknown)=>{if(!Array.isArray(x))return fail();return x.map(obj);};
const check=(x:unknown)=>{if(!x)fail();};
const uuid=(x:unknown)=>typeof x==='string'&&/^[a-f0-9-]{36}$/i.test(x);
const money=(x:unknown)=>typeof x==='string'&&/^-?\d{1,30}$/.test(x);
const text=(x:unknown)=>typeof x==='string'&&x.length>0;
export function parseFinanceSnapshot(raw:unknown):FinanceSnapshot{
 const v=obj(raw);check(v.schema_version===1&&v.environment==='sandbox'&&v.live_enabled===false&&uuid(v.actor)&&money(v.wallet_balance));
 check(typeof v.observed_at==='string'&&Number.isFinite(Date.parse(v.observed_at)));
 for(const f of arr(v.facilities)){check(uuid(f.id)&&text(f.name)&&text(f.seller_name)&&money(f.payable));if(f.tariff!==null){const t=obj(f.tariff);check(uuid(t.id)&&money(t.unit_price)&&Number.isInteger(t.unit_minutes)&&Number.isInteger(t.commission_bps));}}
 for(const p of arr(v.payments)){check(uuid(p.id)&&uuid(p.facility_id)&&uuid(p.user_id)&&[p.gross,p.net,p.commission,p.refunded].every(money));check(BigInt(String(p.gross))===BigInt(String(p.net))+BigInt(String(p.commission))&&BigInt(String(p.refunded))<=BigInt(String(p.gross)));}
 for(const b of arr(v.batches)){check(uuid(b.id)&&uuid(b.facility_id)&&uuid(b.created_by)&&[b.gross,b.net,b.commission].every(money));check(['draft','approved','payout_pending','payout_failed','simulated_paid','cancelled'].includes(String(b.status)));}
 for(const e of arr(v.exports))check(uuid(e.id)&&typeof e.digest==='string'&&/^[a-f0-9]{64}$/.test(e.digest)&&Number.isInteger(e.row_count)&&['prepared','simulated_accepted','erp_posted'].includes(String(e.status)));
 for(const a of arr(v.accounts))check(text(a.code)&&text(a.name)&&text(a.erp_code)&&money(a.debit)&&money(a.credit));
 const r=obj(v.reconciliation);check(r.external_bank_verified===false&&r.external_erp_verified===false);
 const flags=['balanced','wallets_nonnegative','payments_match','refunds_match','facility_payables_match'];for(const k of flags)check(typeof r[k]==='boolean');check(r.passed===flags.every(k=>r[k]));
 const counts=obj(v.counts);for(const k of ['payments','journals','batches','exports'])check(Number.isSafeInteger(counts[k])&&Number(counts[k])>=0);
 return raw as FinanceSnapshot;
}
export type JournalRow={journal_id:string;journal_number:string;entry_date:string;source_kind:string;source_id:string;line_no:number;account:string;erp_account:string;owner_id:string;debit:string;credit:string};
export type JournalExport={schema_version:1;environment:'sandbox';format:'doelv-journal-v1';export_id:string;not_tax_invoice:true;rows:JournalRow[]};
export function parseJournalExport(raw:unknown):JournalExport{
 const v=obj(raw);check(v.schema_version===1&&v.environment==='sandbox'&&v.format==='doelv-journal-v1'&&v.not_tax_invoice===true&&uuid(v.export_id));
 const balances=new Map<string,bigint>(),seen=new Set<string>();const rows=arr(v.rows);check(rows.length>0);
 for(const r of rows){check(uuid(r.journal_id)&&uuid(r.source_id)&&uuid(r.owner_id)&&money(r.debit)&&money(r.credit)&&text(r.entry_date)&&text(r.erp_account)&&Number.isInteger(r.line_no));const key=`${r.journal_id}:${r.line_no}`;check(!seen.has(key));seen.add(key);const d=BigInt(String(r.debit)),c=BigInt(String(r.credit));check((d>0n&&c===0n)||(c>0n&&d===0n));balances.set(String(r.journal_id),(balances.get(String(r.journal_id))??0n)+d-c);}
 check([...balances.values()].every(x=>x===0n));return raw as JournalExport;
}
export function journalCsv(raw:unknown):string{
 const v=parseJournalExport(raw);const keys=['journal_id','journal_number','entry_date','source_kind','source_id','line_no','account','erp_account','owner_id','debit','credit'] as const;
 const cell=(x:unknown)=>{let s=String(x??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+['environment,export_id,'+keys.join(','),...v.rows.map(r=>['sandbox',v.export_id,...keys.map(k=>r[k])].map(cell).join(','))].join('\r\n');
}
export const moneyLabel=(v:string)=>BigInt(v).toLocaleString('ko-KR');
const errors:Record<string,string>={erp_pending_source:'자체 ERP에서 원천 전표를 모두 승인·반영해야 합니다.',erp_account_mapping_required:'자체 ERP에 올바른 분류의 계정과목을 먼저 등록해 주세요.',erp_pending_vouchers:'자체 ERP의 미승인 수기 전표가 남아 있습니다.',finance_mfa_headquarters_required:'최고관리자 계정의 2단계 인증이 필요합니다.',finance_live_not_available:'실거래 연결은 아직 열려 있지 않습니다.',finance_insufficient_balance:'시험 코인 잔액이 부족합니다.',finance_quote_expired:'견적 유효기간이 지났습니다. 다시 견적을 생성해 주세요.',finance_quote_consumed:'이미 결제한 견적입니다. 거래 내역을 확인해 주세요.',finance_idempotency_conflict:'같은 요청 번호에 다른 내용이 있습니다.',finance_tariff_required:'해당 시설의 요금 계약을 먼저 등록해 주세요.',finance_independent_approval_required:'작성자와 다른 최고관리자가 독립 확인해야 합니다.',finance_cancel_unpaid_batch_first:'진행 중인 정산 배치를 먼저 취소해야 환불할 수 있습니다. 지급 결과 미확정 건은 먼저 대사하세요.',finance_open_batch_exists:'이 시설에 진행 중인 정산 배치가 있습니다.',finance_no_positive_settlement:'지급할 순정산금이 없습니다. 음수 조정금은 다음 정산으로 이월합니다.',finance_period_closed:'마감된 날짜에는 새 전표를 기록할 수 없습니다.',finance_unaccepted_exports:'아직 내보내지 않았거나 독립 수신 확인이 없는 전표가 있습니다.',finance_open_batches:'진행 중인 정산 배치를 먼저 완료하거나 취소해 주세요.',finance_export_range:'새로 내보낼 전표가 없거나 기간에 2,000개를 초과합니다.',finance_refund_exceeds_payment:'환불 가능 잔액을 초과했습니다.',finance_erp_ack_mismatch:'ERP 수신 확인의 해시 또는 행 수가 원본과 다릅니다.',finance_invalid_transition:'현재 상태에서 실행할 수 없습니다. 새로 조회해 주세요.'};
export function financeError(e:unknown){const msg=e&&typeof e==='object'&&'message' in e?String(e.message):'';return Object.entries(errors).find(([k])=>msg.includes(k))?.[1]??'결과를 확인하지 못했습니다. 입력값·권한·연결을 확인하고 새로 조회해 주세요. 재시도는 같은 요청 번호로 처리합니다.';}

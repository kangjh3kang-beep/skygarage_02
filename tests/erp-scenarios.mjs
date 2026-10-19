import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function runScenarios({query,exec,stage,apply,native}) {
 let passed=0; const actors=[];
 const t=async(name,fn)=>{await fn();passed++;console.log('PASS',name);};
 const raw=async(q,p=[])=>{await exec('reset role');return (await query(q,p)).rows;};
 const setActor=async(id,aal='aal2')=>{await exec('reset role');await query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,aal,role:'authenticated',user_metadata:{role:'super_admin'}})]);await exec('set role authenticated');};
 const api=async(action,payload={},request=randomUUID(),environment='sandbox')=>{await exec('set role authenticated');return (await query('select public.erp_command($1,$2,$3,$4) r',[environment,request,action,payload])).rows[0].r;};
 const finance=async(action,payload={},request=randomUUID())=>{await exec('set role authenticated');return (await query("select public.finance_command('sandbox',$1,$2,$3) r",[request,action,payload])).rows[0].r;};
 const snap=async(book=null)=>(await query('select public.erp_snapshot($1) r',[book])).rows[0].r;
 const report=async(book,center=null,after=0)=>(await query('select public.erp_report($1,$2,$3,$4,$5) r',[book,'2000-01-01',today,center,after])).rows[0].r;
 const denied=(fn,pattern)=>assert.rejects(fn,pattern);
 const today=(await raw("select (clock_timestamp() at time zone 'Asia/Seoul')::date::text d"))[0].d;
 for(let i=0;i<4;i++){const id=(await raw('insert into auth.users default values returning id'))[0].id;actors.push(id);await raw('insert into public.user_roles(user_id,role) values($1,$2)',[id,i<3?'super_admin':'operator']);}
 await apply(1);await setActor(actors[0]);
 const financeBook=(await snap()).book.id;
 await t('ERP1: anonymous RPC denied',async()=>{await exec('reset role;set role anon');await denied(()=>snap(),/permission denied/);await setActor(actors[0]);});
 await t('ERP1: MFA mandatory',async()=>{await setActor(actors[0],'aal1');await denied(()=>snap(),/mfa_headquarters/);await setActor(actors[0]);});
 await t('ERP1: metadata cannot grant ERP authorization',async()=>{await setActor(actors[3]);await denied(()=>snap(),/mfa_headquarters/);await setActor(actors[0]);});
 await t('ERP1: no direct table access',()=>denied(()=>query('select * from erp_private.lines'),/permission denied/));
 await t('ERP1: live mode rejected',()=>denied(()=>api('book_create',{code:'LIVE',name:'실거래 주장'},randomUUID(),'live'),/live_not_available/));
 const req=randomUUID(),payload={code:'ERP_TEST',name:'독립 시험 장부'};
 const book=(await api('book_create',payload,req)).id;
 await t('ERP1: request retry returns same book',async()=>assert.equal((await api('book_create',payload,req)).id,book));
 await t('ERP1: idempotency conflict rejected',()=>denied(()=>api('book_create',{...payload,name:'변경된 내용'},req),/idempotency_conflict/));
 const center=(await snap(book)).cost_centers[0].id;
 const otherCenter=(await snap(financeBook)).cost_centers[0].id;
 const lines=[{account_code:'TEST_1000',debit:'1000',credit:'0',cost_center_id:center},{account_code:'TEST_3000',debit:'0',credit:'1000',cost_center_id:center}];
 const draft={book_id:book,entry_date:today,note:'시험 기초 자본 납입',evidence_ref:'TEST-OPENING-1',lines};
 await t('ERP1: unbalanced draft rejected atomically',()=>denied(()=>api('voucher_save',{...draft,lines:[lines[0],{...lines[1],credit:'999'}]}),/unbalanced/));
 await t('ERP1: decimal money rejected',()=>denied(()=>api('voucher_save',{...draft,lines:[{...lines[0],debit:'1.1'},lines[1]]}),/integer_required/));
 await t('ERP1: missing evidence rejected',()=>denied(()=>api('voucher_save',{...draft,evidence_ref:''}),/check constraint/));
 await t('ERP1: other book dimension rejected',()=>denied(()=>api('voucher_save',{...draft,lines:[{...lines[0],cost_center_id:otherCenter},lines[1]]}),/foreign key/));
 await t('ERP1: party required on payable account',()=>denied(()=>api('voucher_save',{...draft,lines:[lines[0],{...lines[1],account_code:'TEST_2200'}]}),/party_required/));
 const v=(await api('voucher_save',draft)).id;
 await t('ERP1: draft excluded from report',async()=>assert.equal((await report(book)).balance_sheet.assets,'0'));
 await t('ERP1: author cannot post own draft',()=>denied(()=>api('voucher_post',{book_id:book,voucher_id:v}),/independent_approval/));
 await t('ERP1: author can edit balanced draft',async()=>{await api('voucher_save',{...draft,voucher_id:v,note:'시험 기초 자본 납입 수정'});assert.equal((await query('select public.erp_document($1) r',[v])).rows[0].r.voucher.note,'시험 기초 자본 납입 수정');});
 await setActor(actors[1]);
 await t('ERP1: other user cannot edit draft',()=>denied(()=>api('voucher_save',{...draft,voucher_id:v}),/edit_denied/));
 await api('voucher_post',{book_id:book,voucher_id:v});
 await t('ERP1: independent posting reflected in balance sheet',async()=>{const r=await report(book);assert.equal(r.balance_sheet.assets,'1000');assert.equal(r.balance_sheet.equity,'1000');assert.equal(r.balance_sheet.difference,'0');assert.equal(r.ledger.length,2);});
 await t('ERP1: posted journal cannot be rewritten',()=>denied(()=>raw('update erp_private.vouchers set note=$2 where id=$1',[v,'변경을 시도하는 전표']),/immutable/));
 await t('ERP1: posted line cannot be appended',()=>denied(()=>raw("insert into erp_private.lines(voucher_id,book_id,line_no,account_code,debit,credit) values($1,$2,3,'TEST_1000',1,0)",[v,book]),/immutable/));
 await setActor(actors[0]);
 const reversed=(await api('voucher_reverse',{book_id:book,voucher_id:v,entry_date:today,reason:'기초 잔액 취소 시험'})).id;
 await t('ERP1: duplicate active reversal rejected',()=>denied(()=>api('voucher_reverse',{book_id:book,voucher_id:v,entry_date:today,reason:'중복 역분개 시험'}),/unique constraint/));
 await setActor(actors[1]);await api('voucher_post',{book_id:book,voucher_id:reversed});
 await t('ERP1: reversal preserves history and restores totals',async()=>{const r=await report(book);assert.equal(r.balance_sheet.assets,'0');assert.equal(r.ledger.length,4);assert.equal((await snap(book)).counts.posted,2);});
 const party=(await api('party_create',{book_id:book,code:'SUPPLIER_A',name:'시험 공급업체',kind:'supplier'})).id;
 const expense=(await api('voucher_save',{...draft,note:'시험 비용과 미지급금',lines:[{...lines[0],account_code:'TEST_5100',debit:'125'},{...lines[1],account_code:'TEST_2200',credit:'125',party_id:party}]})).id;
 await setActor(actors[0]);await api('voucher_post',{book_id:book,voucher_id:expense});
 await t('ERP1: profit and party balance cover posted entries',async()=>{const r=await report(book);assert.equal(r.profit_loss.expense,'125');assert.equal(r.profit_loss.profit,'-125');assert.equal(r.balance_sheet.liabilities,'125');assert.equal(r.balance_sheet.difference,'0');assert.equal(r.party_balances[0].balance,'-125');});
 await t('ERP1: report rejects foreign cost center',()=>denied(()=>report(book,otherCenter),/dimension_mismatch/));
 await t('ERP1: ledger pagination preserves full report totals',async()=>{const r=await report(book);const next=await report(book,null,r.next_after);assert.equal(next.ledger.length,0);assert.equal(next.profit_loss.profit,'-125');});
 const unposted=(await api('voucher_save',draft)).id;
 await t('ERP1: open draft prevents close',()=>denied(()=>api('period_close',{book_id:book,through_date:today,note:'기간 마감 조건 검증'}),/pending_vouchers/));
 await api('voucher_void',{book_id:book,voucher_id:unposted,reason:'중복 입력 초안 취소'});
 await api('period_close',{book_id:book,through_date:today,note:'시험 원장 검증 완료'});
 await t('ERP1: closed period blocks new drafts',()=>denied(()=>api('voucher_save',draft),/period_closed/));
 await t('ERP1: audit is immutable',()=>denied(()=>raw('delete from erp_private.events'),/immutable/));
 await setActor(actors[0]);
 await t('ERP1: private tables protected by RLS and no grants',async()=>{const r=(await raw("select count(*)::integer n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='erp_private' and c.relkind='r' and (not c.relrowsecurity or has_table_privilege('authenticated',c.oid,'select,insert,update,delete') or has_table_privilege('anon',c.oid,'select,insert,update,delete'))"))[0];assert.equal(r.n,0);});
 await t('ERP1: deferred constraint rejects empty posted journal',()=>denied(()=>raw("insert into erp_private.vouchers(book_id,entry_date,note,evidence_ref,source,status,created_by,posted_by,posted_at) values($1,$2,'빈 확정 전표 거부','TEST-BAD','manual','posted',$3,$4,now())",[financeBook,today,actors[0],actors[1]]),/unbalanced/));
 await setActor(actors[0]);const pageBook=(await api('book_create',{code:'PAGED',name:'원장 페이지 검증'})).id;
 const pageDraft={...draft,book_id:pageBook,lines:lines.map(({cost_center_id,...l})=>l)};
 const waiting=(await api('voucher_save',pageDraft)).id;
 for(let n=0;n<101;n++){await setActor(actors[0]);const id=(await api('voucher_save',pageDraft)).id;await setActor(actors[1]);await api('voucher_post',{book_id:pageBook,voucher_id:id});}
 await t('ERP1: full totals survive a 100-voucher page boundary',async()=>{const first=await report(pageBook);const second=await report(pageBook,null,first.next_after);assert.equal(first.ledger.length,200);assert.equal(second.ledger.length,2);assert.equal(first.balance_sheet.assets,'101000');assert.deepEqual(first.balance_sheet,second.balance_sheet);});
 await t('ERP1: approval queue retains old draft beyond recent 100',async()=>assert.equal((await snap(pageBook)).vouchers[0].id,waiting));
 console.log('ERP_STAGE_1_COMPLETE',passed);
 if(stage>=2){
  await setActor(actors[0]);await finance('test_credit',{amount:'10'});
  const legacy=await finance('export_prepare',{from_date:today,to_date:today});
  await setActor(actors[1]);await finance('simulate_erp_ack',{export_id:legacy.id,digest:legacy.digest,row_count:legacy.row_count,receipt:'SIM-legacy-ack'});
  await apply(2);await integration(legacy);
 }
 console.log('ERP_CHECKS_PASSED='+passed);
 async function integration(legacy){
  await setActor(actors[0]);
  await t('ERP2: old simulated acknowledgement is not posted ERP',async()=>{const s=await snap();assert.equal(s.pending_exports.length,1);assert.equal(s.reconciliation.source_reconciled,false);assert.equal(s.counts.posted,0);});
  await t('ERP2: old simulated acknowledgement cannot close source',()=>denied(()=>finance('period_close',{through_date:today,note:'모의 확인만으로 마감 시도'}),/pending_source/));
  const imported=await api('finance_receive',{book_id:financeBook,export_id:legacy.id});
  await t('ERP2: retry import does not duplicate vouchers',async()=>{assert.equal((await api('finance_receive',{book_id:financeBook,export_id:legacy.id})).id,imported.id);assert.equal((await snap()).counts.vouchers,1);});
  await t('ERP2: finance import cannot post individual voucher',()=>denied(async()=>api('voucher_post',{book_id:financeBook,voucher_id:(await snap()).vouchers[0].id}),/source_correction/));
  await t('ERP2: source author cannot approve own import',()=>denied(()=>api('import_post',{book_id:financeBook,import_id:imported.id}),/independent_approval/));
  await setActor(actors[1]);await api('import_post',{book_id:financeBook,import_id:imported.id});
  await t('ERP2: ERP posting acknowledges source only after persistence',async()=>{const r=(await raw('select status,receipt from finance_private.exports where id=$1',[legacy.id]))[0];assert.equal(r.status,'erp_posted');assert.match(r.receipt,/^OWN-ERP-/);});
  await setActor(actors[0]);
  await t('ERP2: legacy fake acknowledgement API is retired',()=>denied(()=>finance('simulate_erp_ack',{}),/real_internal_posting_required/));
  await t('ERP2: unknown ERP mapping rejected',()=>denied(()=>finance('account_map',{account:'commission',erp_code:'MISSING'}),/account_mapping_required/));
  await t('ERP2: wrong account classification rejected',()=>denied(()=>finance('account_map',{account:'commission',erp_code:'TEST_1000'}),/account_mapping_required/));
  await api('account_create',{book_id:financeBook,code:'FEE_NEW',name:'시설 이용 수수료',kind:'income'});
  await finance('account_map',{account:'commission',erp_code:'FEE_NEW'});
  const home=(await finance('facility_create',{name:'ERP 소속단지',seller_name:'ERP 운영사 A',kind:'residential'})).id;
  const away=(await finance('facility_create',{name:'ERP 외부 주차장',seller_name:'ERP 운영사 B',kind:'public_parking'})).id;
  await finance('tariff_create',{facility_id:home,unit_minutes:'30',unit_price:'1000',commission_bps:'1000'});
  await finance('tariff_create',{facility_id:away,unit_minutes:'30',unit_price:'1001',commission_bps:'1500'});
  await finance('membership_set',{facility_id:home});await finance('test_credit',{amount:'10000'});
  const q=await finance('quote',{facility_id:away,minutes:'30'});const payment=await finance('pay',{quote_id:q.id});
  await finance('refund',{payment_id:payment.id,amount:'333',reason:'부분 이용 취소 시험'});
  await setActor(actors[2]);await finance('test_credit',{amount:'3000'});
  const uq=await finance('quote',{facility_id:away,minutes:'30'});await finance('pay',{quote_id:uq.id});
  await t('ERP2: home-away and unaffiliated source relations preserved',async()=>{assert.equal(q.relation,'away');assert.equal(uq.relation,'unaffiliated');});
  await setActor(actors[0]);const batch=await finance('batch_create',{facility_id:away,through_date:today});
  await setActor(actors[1]);await finance('batch_approve',{batch_id:batch.id});await finance('payout_request',{batch_id:batch.id});
  await finance('simulate_payout_result',{batch_id:batch.id,amount:batch.net,outcome:'succeeded',receipt:'SIM-ERP-payout'});
  await t('ERP2: unexported source prevents ERP close',()=>denied(()=>api('period_close',{book_id:financeBook,through_date:today,note:'원천 전표 미전송 상태'}),/pending_source/));
  const ex=await finance('export_prepare',{from_date:today,to_date:today});
  await t('ERP2: finance export atomically creates ERP import',async()=>{assert.equal(ex.erp_status,'received');assert.ok(ex.erp_import_id);assert.equal((await snap()).imports.length,2);});
  await t('ERP2: draft import excluded from report',async()=>assert.equal((await report(financeBook)).balance_sheet.assets,'10'));
  await t('ERP2: received import still blocks source close',()=>denied(()=>finance('period_close',{through_date:today,note:'ERP 반영 전 마감 시도'}),/pending_source/));
  await t('ERP2: tampered draft line rejected by source reconciliation',async()=>{
   await exec('begin');
   try{await raw('update erp_private.lines set debit=debit+1 where voucher_id=(select id from erp_private.vouchers where import_id=$1 order by number limit 1) and debit>0',[ex.erp_import_id]);await setActor(actors[0]);await denied(()=>api('import_post',{book_id:financeBook,import_id:ex.erp_import_id}),/source_mismatch/);}
   finally{await exec('rollback');await setActor(actors[1]);}
  });
  await t('ERP2: facility dimension tampering is detected',async()=>{
   await exec('begin');
   try{await raw("update erp_private.lines set cost_center_id=(select id from erp_private.cost_centers where book_id=$1 and code='HQ') where voucher_id in (select id from erp_private.vouchers where import_id=$2 and source_journal_id in (select journal_id from finance_private.payments))",[financeBook,ex.erp_import_id]);await setActor(actors[0]);await denied(()=>api('import_post',{book_id:financeBook,import_id:ex.erp_import_id}),/source_mismatch/);}
   finally{await exec('rollback');await setActor(actors[1]);}
  });
  await t('ERP2: bad export hash rejected without durable import',async()=>{
   await exec('begin');
   try{const id=randomUUID();await raw("insert into finance_private.exports(id,from_date,to_date,payload,digest,created_by) select $1::uuid,from_date,to_date,jsonb_set(payload,'{export_id}',to_jsonb(($1::uuid)::text)),repeat('0',64),created_by from finance_private.exports where id=$2",[id,ex.id]);await setActor(actors[0]);await denied(()=>api('finance_receive',{book_id:financeBook,export_id:id}),/source_mismatch/);}
   finally{await exec('rollback');await setActor(actors[1]);}
  });
  await t('ERP2: source author still cannot approve after retries',()=>denied(()=>api('import_post',{book_id:financeBook,import_id:ex.erp_import_id}),/independent_approval/));
  await setActor(actors[0]);await api('import_post',{book_id:financeBook,import_id:ex.erp_import_id});
  await t('ERP2: source amounts and facility beneficiary reconcile',async()=>{const r=await report(financeBook);assert.equal(r.profit_loss.income,'251');assert.equal(r.balance_sheet.assets,'11592');assert.equal(r.balance_sheet.liabilities,'11341');assert.equal(r.balance_sheet.difference,'0');const s=await snap();assert.equal(s.reconciliation.source_reconciled,true);assert.equal(s.parties.length,1);assert.equal(s.parties[0].facility_id,away);});
  await t('ERP2: facility report uses actual facility cost center',async()=>{const s=await snap();const c=s.cost_centers.find(x=>x.facility_id===away);assert.ok(c);const r=await report(financeBook,c.id);assert.equal(r.profit_loss.profit,'251');assert.equal(r.party_balances[0].balance,'0');});
  await t('ERP2: immutable mapping does not rewrite old export',async()=>{const row=(await raw("select payload->'rows'->0->>'erp_account' a from finance_private.exports where id=$1",[legacy.id]))[0];assert.equal(row.a,'TEST_1000');});
  await setActor(actors[0]);
  await t('ERP2: imported journal corrections must originate in finance',()=>denied(async()=>api('voucher_reverse',{book_id:financeBook,voucher_id:(await snap()).vouchers[0].id,entry_date:today,reason:'수신 전표 임의 역분개'}),/source_correction/));
  await t('ERP2: provider slots start unassigned and disabled',async()=>{const s=await snap();assert.equal(s.providers.length,2);assert.ok(s.providers.every(x=>x.status==='unassigned'&&!x.live_enabled));});
  await t('ERP2: provider plans cannot enable live or accept secrets',()=>denied(()=>api('provider_plan',{book_id:financeBook,kind:'payment',vendor_code:'example',label:'예정 사업자',live_enabled:true}),/invalid_provider_plan/));
  await api('provider_plan',{book_id:financeBook,kind:'payment',vendor_code:'example',label:'시험 지정 예시'});
  await t('ERP2: planned provider remains disconnected',async()=>{const p=(await snap()).providers.find(x=>x.kind==='payment');assert.equal(p.status,'planned');assert.equal(p.live_enabled,false);});
  await api('provider_plan',{book_id:financeBook,kind:'payment',vendor_code:'',label:''});
  await t('ERP2: provider payload cannot hide a secret in substituted keys',()=>denied(()=>api('provider_plan',{book_id:financeBook,kind:'payment',vendor_code:'example',secret:'not-a-real-secret'}),/invalid_provider_plan/));
  await t('ERP2: ERP can initiate source synchronization',async()=>{await finance('test_credit',{amount:'2'});const synced=await api('finance_sync',{book_id:financeBook,from_date:today,to_date:today});assert.equal(synced.erp_status,'received');await setActor(actors[1]);await api('import_post',{book_id:financeBook,import_id:synced.erp_import_id});await setActor(actors[0]);});
  if(native){
   const cb=(await api('book_create',{code:'CONCURRENCY',name:'동시 승인 검증 장부'})).id;
   const dp={...draft,book_id:cb,lines:lines.map(({cost_center_id,...x})=>x)};
   const request=randomUUID(),clients=Array.from({length:8},()=>native.getPgClient('postgres','127.0.0.1'));let cv;
   await t('ERP2 native: 8 concurrent retries create one draft',async()=>{
    try{const values=await Promise.all(clients.map(async c=>{await c.connect();await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actors[0],aal:'aal2'})]);await c.query('set role authenticated');return (await c.query("select public.erp_command('sandbox',$1,'voucher_save',$2) r",[request,JSON.stringify(dp)])).rows[0].r;}));assert.equal(new Set(values.map(x=>x.id)).size,1);cv=values[0].id;}
    finally{await Promise.all(clients.map(c=>c.end()));}
   });
   const cs=actors.slice(1,3).map(()=>native.getPgClient('postgres','127.0.0.1'));
   await t('ERP2 native: competing approvers post a voucher once',async()=>{
    try{const values=await Promise.allSettled(cs.map(async(c,i)=>{await c.connect();await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actors[i+1],aal:'aal2'})]);await c.query('set role authenticated');return c.query("select public.erp_command('sandbox',$1,'voucher_post',$2)",[randomUUID(),JSON.stringify({book_id:cb,voucher_id:cv})]);}));assert.equal(values.filter(x=>x.status==='fulfilled').length,1);assert.match(values.find(x=>x.status==='rejected').reason.message,/draft_required/);}
    finally{await Promise.all(cs.map(c=>c.end()));}
   });
  }
  // Simulate the legacy source already being closed before ERP migration/integration.
  await raw('insert into finance_private.period_closures(through_date,note,actor) values($1,$2,$3)',[today,'이전 원천 마감 기록',actors[1]]);
  await raw('update finance_private.control set closed_through=$1',[today]);
  await setActor(actors[0]);await api('period_close',{book_id:financeBook,through_date:today,note:'자체 ERP 원천대사 완료'});
  await t('ERP2: prior source close is preserved during ERP close',async()=>assert.equal((await raw('select note from finance_private.period_closures where through_date=$1',[today]))[0].note,'이전 원천 마감 기록'));
  await t('ERP2: closing ERP also closes source ledger',async()=>{const c=(await raw('select closed_through::text d from finance_private.control'))[0];assert.equal(c.d,today);});
  await setActor(actors[0]);
  await t('ERP2: closed ERP source rejects new coin postings',()=>denied(()=>finance('test_credit',{amount:'1'}),/period_closed/));
  await t('ERP2: final source reconciliation remains correct',async()=>{const s=await snap();assert.equal(s.reconciliation.balanced,true);assert.equal(s.reconciliation.source_reconciled,true);assert.equal(s.reconciliation.external_bank_verified,false);});
  await t('ERP2: integration helpers not directly executable',async()=>{const r=(await raw("select count(*)::integer n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('erp_private','finance_private') and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))"))[0];assert.equal(r.n,0);});
  console.log('ERP_STAGE_2_COMPLETE',passed);
 }
}

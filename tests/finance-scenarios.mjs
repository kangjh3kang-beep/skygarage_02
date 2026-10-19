import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function runScenarios({query,exec,stage,apply,native}) {
 let passed=0,actor;const actors=[];
 const t=async(name,fn)=>{await fn();passed++;console.log('PASS',name);};
 const raw=async(q,p=[])=>{await exec('reset role');return (await query(q,p)).rows;};
 for(let i=0;i<3;i++){const id=(await raw('insert into auth.users default values returning id'))[0].id;actors.push(id);await raw('insert into public.user_roles(user_id,role) values($1,$2)',[id,i<2?'super_admin':'operator']);}
 const setActor=async(id,aal='aal2')=>{actor=id;await exec('reset role');await query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,aal,role:'authenticated',user_metadata:{role:'super_admin'}})]);await exec('set role authenticated');};
 const api=async(action,payload={},request=randomUUID(),environment='sandbox')=>{await exec('set role authenticated');return (await query('select public.finance_command($1,$2,$3,$4) result',[environment,request,action,payload])).rows[0].result;};
 const denied=async(fn,pattern)=>assert.rejects(fn,pattern);
 await apply(1);await setActor(actors[0]);
 await t('stage1: live mode unavailable',()=>denied(()=>api('test_credit',{amount:100},randomUUID(),'live'),/live_not_available/));
 await t('stage1: anonymous execute denied',async()=>{await exec('reset role;set role anon');await denied(()=>query("select public.finance_command('sandbox',$1,'test_credit','{}')",[randomUUID()]),/permission denied/);await setActor(actors[0]);});
 await t('stage1: MFA mandatory',async()=>{await setActor(actors[0],'aal1');await denied(()=>api('test_credit',{amount:100}),/mfa_headquarters/);await setActor(actors[0]);});
 await t('stage1: forged user metadata grants no role',async()=>{await setActor(actors[2]);await denied(()=>api('test_credit',{amount:100}),/mfa_headquarters/);await setActor(actors[0]);});
 await t('stage1: direct tables denied',()=>denied(()=>query('select * from finance_private.lines'),/permission denied/));
 for(const amount of [-1,0,1.5,'NaN','1e5',1000001])await t(`stage1: invalid credit ${amount}`,()=>denied(()=>api('test_credit',{amount}),/finance_/));
 const req=randomUUID();const grant=await api('test_credit',{amount:10000},req);
 await t('stage1: duplicate request returns same posting',async()=>assert.deepEqual(await api('test_credit',{amount:10000},req),grant));
 await t('stage1: reused request with different content rejected',()=>denied(()=>api('test_credit',{amount:9999},req),/idempotency_conflict/));
 await t('stage1: credit is balanced and exact',async()=>{const x=(await raw("select sum(debit)::text d,sum(credit)::text c from finance_private.lines"))[0];assert.deepEqual(x,{d:'10000',c:'10000'});});
 await t('stage1: immutable posted entries',()=>denied(()=>raw('update finance_private.lines set debit=2'),/immutable/));
 await t('stage1: blank journal rejected at commit',async()=>{await exec('reset role');await denied(()=>exec(`insert into finance_private.journals(kind,source_id,note,actor) values('bad',gen_random_uuid(),'bad','${actors[0]}')`),/unbalanced/);});
 await setActor(actors[0]);
 const home=(await api('facility_create',{name:'시험 주거단지',kind:'residential',seller_name:'시험 운영사 A'})).id;
 const away=(await api('facility_create',{name:'시험 일반주차장',kind:'public_parking',seller_name:'시험 운영사 B'})).id;
 await t('stage1: distinct facility types and beneficiaries',async()=>{const rows=await raw('select count(distinct seller_name)::integer n from finance_private.facilities');assert.equal(rows[0].n,2);});
 await setActor(actors[0]);
 await api('tariff_create',{facility_id:home,unit_minutes:30,unit_price:1000,commission_bps:1000});
 await api('tariff_create',{facility_id:away,unit_minutes:30,unit_price:1001,commission_bps:1500});
 await t('stage1: tariff cannot be edited retroactively',()=>denied(()=>raw('update finance_private.tariffs set commission_bps=9999'),/immutable/));
 await setActor(actors[0]);await api('membership_set',{facility_id:home});
 console.log('STAGE_1_COMPLETE',passed);
 if(stage>=2){await apply(2);await paymentScenarios();}
 if(stage>=3){await apply(3);await accountingScenarios();}
 console.log('FINANCE_CHECKS_PASSED='+passed);
 async function paymentScenarios(){
 await setActor(actors[0]);
 const h=await api('quote',{facility_id:home,minutes:30});
 await t('stage2: own facility quote with server split',async()=>{assert.equal(h.relation,'home');assert.equal(h.gross,'1000');assert.equal(h.commission,'100');assert.equal(h.net,'900');});
 const payReq=randomUUID();const hp=await api('pay',{quote_id:h.id},payReq);
 await t('stage2: payment retry has single journal',async()=>assert.deepEqual(await api('pay',{quote_id:h.id},payReq),hp));
 await t('stage2: same quote cannot pay twice',()=>denied(()=>api('pay',{quote_id:h.id}),/quote_consumed/));
 const aq=await api('quote',{facility_id:away,minutes:30});
 await t('stage2: away facility receives net, not home facility',async()=>{assert.equal(aq.relation,'away');assert.equal(aq.gross,'1001');assert.equal(aq.net,'851');});
 await api('tariff_create',{facility_id:away,unit_minutes:30,unit_price:2000,commission_bps:2000});
 const ap=await api('pay',{quote_id:aq.id});
 await t('stage2: quoted contract preserved after new tariff',async()=>{const p=(await raw('select facility_id,net::text from finance_private.payments where id=$1',[ap.id]))[0];assert.equal(p.facility_id,away);assert.equal(p.net,'851');});
 await setActor(actors[0]);await api('membership_set',{facility_id:null});
 const uq=await api('quote',{facility_id:away,minutes:30});
 await t('stage2: unaffiliated customer can obtain facility quote',async()=>assert.equal(uq.relation,'unaffiliated'));
 await setActor(actors[1]);await t('stage2: another user cannot spend quote',()=>denied(()=>api('pay',{quote_id:uq.id}),/quote_unavailable/));
 await setActor(actors[0]);
 const big=await api('quote',{facility_id:away,minutes:1440});
 await t('stage2: insufficient balance atomic rejection',()=>denied(()=>api('pay',{quote_id:big.id}),/insufficient_balance/));
 const expired=(await raw("insert into finance_private.quotes(user_id,facility_id,tariff_id,relation,minutes,gross,commission,net,expires_at) select user_id,facility_id,tariff_id,relation,minutes,gross,commission,net,now()-interval '1 second' from finance_private.quotes where id=$1 returning id",[uq.id]))[0].id;
 await setActor(actors[0]);await t('stage2: expired quote denied',()=>denied(()=>api('pay',{quote_id:expired}),/quote_expired/));
 const rr=randomUUID();const rf=await api('refund',{payment_id:ap.id,amount:1,reason:'부분 환불 시험'},rr);
 await t('stage2: refund retry idempotent',async()=>assert.deepEqual(await api('refund',{payment_id:ap.id,amount:1,reason:'부분 환불 시험'},rr),rf));
 await api('refund',{payment_id:ap.id,amount:1,reason:'부분 환불 시험'});await api('refund',{payment_id:ap.id,amount:999,reason:'잔여 전액 환불'});
 await t('stage2: cumulative partial refunds exactly reverse rounding',async()=>{assert.deepEqual((await raw('select sum(gross)::text g,sum(commission)::text c,sum(net)::text n from finance_private.refunds where payment_id=$1',[ap.id]))[0],{g:'1001',c:'150',n:'851'});});
 await setActor(actors[0]);await t('stage2: over-refund denied',()=>denied(()=>api('refund',{payment_id:ap.id,amount:1,reason:'초과 환불 차단'}),/refund_exceeds/));
 const today=(await raw("select (now() at time zone 'Asia/Seoul')::date::text d"))[0].d;await setActor(actors[0]);
 const batch=await api('batch_create',{facility_id:home,through_date:today});
 await t('stage2: all pending entries counted once',async()=>{assert.equal(batch.net,'900');assert.equal(batch.count,1);});
 await t('stage2: duplicate open batch denied',()=>denied(()=>api('batch_create',{facility_id:home,through_date:today}),/open_batch/));
 await t('stage2: refund during unpaid batch blocked',()=>denied(()=>api('refund',{payment_id:hp.id,amount:200,reason:'진행중 환불 차단'}),/cancel_unpaid_batch/));
 await t('stage2: self approval denied',()=>denied(()=>api('batch_approve',{batch_id:batch.id}),/independent_approval/));
 await setActor(actors[1]);await api('batch_approve',{batch_id:batch.id});await api('payout_request',{batch_id:batch.id});
 const key=(await raw('select provider_key from finance_private.payout_outbox where batch_id=$1',[batch.id]))[0].provider_key;await setActor(actors[1]);
 await t('stage2: payout amount mismatch denied',()=>denied(()=>api('simulate_payout_result',{batch_id:batch.id,outcome:'succeeded',receipt:'SIM-mismatch',amount:901}),/amount_mismatch/));
 await api('simulate_payout_result',{batch_id:batch.id,outcome:'unknown',receipt:'SIM-unknown',amount:900});
 await t('stage2: unknown payout never marked paid',async()=>assert.equal((await raw('select status from finance_private.batches where id=$1',[batch.id]))[0].status,'payout_pending'));
 await setActor(actors[1]);await api('simulate_payout_result',{batch_id:batch.id,outcome:'failed',receipt:'SIM-failed',amount:900});await api('payout_request',{batch_id:batch.id});
 await t('stage2: payout retry preserves provider key',async()=>assert.equal((await raw('select provider_key from finance_private.payout_outbox where batch_id=$1',[batch.id]))[0].provider_key,key));
 await setActor(actors[1]);await api('simulate_payout_result',{batch_id:batch.id,outcome:'succeeded',receipt:'SIM-succeeded',amount:900});
 await api('simulate_payout_result',{batch_id:batch.id,outcome:'succeeded',receipt:'SIM-succeeded',amount:900});
 await t('stage2: duplicate provider outcome posts one clearing entry',async()=>assert.equal((await raw("select count(*)::integer n from finance_private.journals where kind='simulated_payout'"))[0].n,1));
 await setActor(actors[0]);await api('refund',{payment_id:hp.id,amount:200,reason:'지급후 환불 차감이월'});
 await t('stage2: paid refund carried as negative facility payable',async()=>assert.equal((await raw("select finance_private.balance('facility',$1)::text n",[home]))[0].n,'-180'));
 await setActor(actors[0]);await t('stage2: negative carryforward is not a payout',()=>denied(()=>api('batch_create',{facility_id:home,through_date:today}),/no_positive/));
 const h2=await api('quote',{facility_id:home,minutes:30});await api('pay',{quote_id:h2.id});const b2=await api('batch_create',{facility_id:home,through_date:today});
 await t('stage2: next settlement offsets paid refund',async()=>assert.equal(b2.net,'720'));
 await api('batch_cancel',{batch_id:b2.id});const b3=await api('batch_create',{facility_id:home,through_date:today});
 await t('stage2: cancelled batch releases items without duplication',async()=>assert.equal(b3.net,'720'));
 await api('batch_cancel',{batch_id:b3.id});
 await t('stage2: all journal amounts conserved',async()=>{const x=(await raw('select sum(debit)::text d,sum(credit)::text c from finance_private.lines'))[0];assert.equal(x.d,x.c);});
 const edge=(await api('facility_create',{name:'수수료 경계 시험장',kind:'public_parking',seller_name:'시험 운영사 C'})).id;
 for(const rate of [0,10000]){await api('tariff_create',{facility_id:edge,unit_minutes:30,unit_price:1000,commission_bps:rate});const q=await api('quote',{facility_id:edge,minutes:30});const p=await api('pay',{quote_id:q.id});await api('refund',{payment_id:p.id,amount:1000,reason:'경계 수수료 환불 시험'});await t('stage2: exact reversal at commission bps '+rate,async()=>{const r=(await raw('select sum(commission)::text c,sum(net)::text n from finance_private.refunds where payment_id=$1',[p.id]))[0];assert.equal(r.c,String(rate/10));assert.equal(r.n,String(1000-rate/10));});await setActor(actors[0]);}
 if(native){
  const request=randomUUID();const cs=Array.from({length:8},()=>native.getPgClient('postgres','127.0.0.1'));
  await t('stage2 native: 8 parallel identical credits post once',async()=>{try{const results=await Promise.all(cs.map(async c=>{await c.connect();await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actors[0],aal:'aal2'})]);await c.query('set role authenticated');return (await c.query("select public.finance_command('sandbox',$1,'test_credit',$2) r",[request,JSON.stringify({amount:123})])).rows[0].r;}));assert.equal(new Set(results.map(x=>x.id)).size,1);}finally{await Promise.all(cs.map(c=>c.end()));}});
 }
 if(native){
  await setActor(actors[1]);await api('test_credit',{amount:9000});const quotes=[await api('quote',{facility_id:home,minutes:210}),await api('quote',{facility_id:home,minutes:210})];
  const cs=quotes.map(()=>native.getPgClient('postgres','127.0.0.1'));
  await t('stage2 native: competing payments cannot overspend',async()=>{try{const results=await Promise.allSettled(cs.map(async(c,i)=>{await c.connect();await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actors[1],aal:'aal2'})]);await c.query('set role authenticated');return c.query("select public.finance_command('sandbox',$1,'pay',$2)",[randomUUID(),JSON.stringify({quote_id:quotes[i].id})]);}));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/insufficient_balance/);assert.equal((await raw("select finance_private.balance('wallet',$1)::text n",[actors[1]]))[0].n,'2000');}finally{await Promise.all(cs.map(c=>c.end()));}});
 }
 console.log('STAGE_2_COMPLETE',passed);
}
 async function accountingScenarios(){
 await setActor(actors[0]);
 const snapshot=async()=>{await exec('set role authenticated');return (await query("select public.finance_snapshot('sandbox') r")).rows[0].r;};
 await t('stage3: complete internal reconciliation passes',async()=>{const s=await snapshot();assert.equal(s.reconciliation.passed,true);assert.equal(s.reconciliation.external_bank_verified,false);assert.equal(s.live_enabled,false);});
 const today=(await raw("select (now() at time zone 'Asia/Seoul')::date::text d"))[0].d;await setActor(actors[0]);
 await t('stage3: CSV formula account mapping rejected',()=>denied(()=>api('account_map',{account:'cash',erp_code:'=cmd()'}),/invalid_account_mapping/));
 await api('account_map',{account:'cash',erp_code:'SANDBOX_1000'});
 await t('stage3: close blocked until export acknowledged',()=>denied(()=>api('period_close',{through_date:today,note:'미확인 전표 마감 차단'}),/unaccepted_exports/));
 const req=randomUUID();const ex=await api('export_prepare',{from_date:'2020-01-01',to_date:today},req);
 await t('stage3: export retry returns exact manifest',async()=>assert.deepEqual(await api('export_prepare',{from_date:'2020-01-01',to_date:today},req),ex));
 await t('stage3: overlapping export cannot duplicate journal',()=>denied(()=>api('export_prepare',{from_date:'2020-01-01',to_date:today}),/export_range/));
 const output=(await query('select public.finance_export_get($1) r',[ex.id])).rows[0].r;
 await t('stage3: export hash and canonical bytes match',async()=>{const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(output.canonical_payload).digest('hex'),output.digest);assert.deepEqual(JSON.parse(output.canonical_payload),output.payload);});
 await t('stage3: each exported journal is balanced',async()=>{const totals=new Map();for(const l of output.payload.rows)totals.set(l.journal_id,(totals.get(l.journal_id)??0n)+BigInt(l.debit)-BigInt(l.credit));assert.ok([...totals.values()].every(x=>x===0n));});
 await api('account_map',{account:'cash',erp_code:'SANDBOX_2000'});
 await t('stage3: previous export mapping frozen',async()=>{const r=(await query('select public.finance_export_get($1) r',[ex.id])).rows[0].r;assert.equal(r.digest,output.digest);assert.ok(r.payload.rows.filter(x=>x.account==='cash').every(x=>x.erp_account==='SANDBOX_1000'));});
 await t('stage3: self ERP acknowledgement denied',()=>denied(()=>api('simulate_erp_ack',{export_id:ex.id,digest:ex.digest,row_count:ex.row_count,receipt:'SIM-erp-self'}),/independent_approval/));
 await setActor(actors[1]);
 await t('stage3: wrong ERP hash rejected',()=>denied(()=>api('simulate_erp_ack',{export_id:ex.id,digest:'0'.repeat(64),row_count:ex.row_count,receipt:'SIM-erp-wrong'}),/ack_mismatch/));
 await t('stage3: wrong ERP row count rejected',()=>denied(()=>api('simulate_erp_ack',{export_id:ex.id,digest:ex.digest,row_count:ex.row_count+1,receipt:'SIM-erp-count'}),/ack_mismatch/));
 await api('simulate_erp_ack',{export_id:ex.id,digest:ex.digest,row_count:ex.row_count,receipt:'SIM-erp-accepted'});
 await t('stage3: accepted export immutable',()=>denied(()=>raw("update finance_private.exports set digest=repeat('1',64)"),/immutable/));
 await setActor(actors[1]);await api('period_close',{through_date:today,note:'내부 모형 전표 검증 후 마감'});
 await t('stage3: closed period rejects new credits',()=>denied(()=>api('test_credit',{amount:100}),/period_closed/));
 await t('stage3: final reconciliation remains balanced',async()=>assert.equal((await snapshot()).reconciliation.passed,true));
 await setActor(actors[2]);await t('stage3: non-HQ cannot read finance snapshot',()=>denied(()=>snapshot(),/mfa_headquarters/));
 await setActor(actors[0]);
 await t('stage3: every private table has RLS and no browser grants',async()=>{const r=(await raw("select count(*)::integer n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='finance_private' and c.relkind='r' and (not c.relrowsecurity or has_table_privilege('authenticated',c.oid,'select,insert,update,delete') or has_table_privilege('anon',c.oid,'select,insert,update,delete'))"))[0];assert.equal(r.n,0);});
 console.log('STAGE_3_COMPLETE',passed);
}
}

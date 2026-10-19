/** Real React components + real SQL in disposable PostgreSQL/WASM.
 * Supabase Auth/Data API transport is replaced; no hosted connection or live money.
 */
import { state,reset } from './browser-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const React=await import('react');
const {render,cleanup,waitFor,fireEvent}=await import('@testing-library/react');
const {default:App}=await import('../../src/App.tsx');
const id='11111111-1111-4111-8111-111111111111',reviewer='22222222-2222-4222-8222-222222222222';
test('synthetic operator UI → actual sandbox ledger → export → independent ERP posting → report',async()=>{
 reset();const db=await PGlite.create({extensions:{pgcrypto}});let tail=Promise.resolve();const trace=[];
 try {
  await db.exec(readFileSync(new URL('../governance-bootstrap.sql',import.meta.url),'utf8'));
  for(const file of ['finance-01-core.sql','finance-02-payments.sql','finance-03-accounting.sql','erp-01-ledger.sql','erp-02-integration.sql'])await db.exec(readFileSync(new URL('../../supabase/sql/'+file,import.meta.url),'utf8'));
  for(const actor of [id,reviewer]){await db.query('insert into auth.users(id) values($1)',[actor]);await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[actor]);}
  const allowed=new Set(['finance_snapshot','finance_command','finance_export_get','erp_snapshot','erp_command','erp_report','erp_document']);
  state.rpcExecutor=(name,payload={},actor)=>{
   if(!allowed.has(name))return {data:null,error:{message:'harness_rpc_not_supported'}};
   const work=tail.then(async()=>{
    await db.exec('begin');
    try {
     await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,aal:'aal2',role:'authenticated'})]);await db.exec('set local role authenticated');
     const entries=Object.entries(payload);assert.ok(entries.every(([k])=>/^p_[a-z_]+$/.test(k)));
     const sql=`select public.${name}(${entries.map(([k],i)=>`${k}=>$${i+1}`).join(',')}) result`;
     const row=(await db.query(sql,entries.map(([,v])=>v))).rows[0].result;
     await db.exec('commit');trace.push({rpc:name,action:payload.p_action||'read',actor:actor===id?'preparer':'reviewer',result:'success'});return {data:row,error:null};
    }catch(e){await db.exec('rollback');trace.push({rpc:name,action:payload.p_action||'read',result:'rejected'});return {data:null,error:{message:e.message,code:e.code}};}
   });tail=work.then(()=>{},()=>{});return work;
  };
  async function open(path){cleanup();window.history.replaceState({},'',path);const v=render(React.createElement(App));await waitFor(()=>assert.ok(v.container.textContent.includes(path.endsWith('erp')?'원천 전표 승인 대기함':'시험 시설·수취 운영사')),{timeout:10000});return v;}
  const enter=(v,label,value)=>fireEvent.change(v.getByLabelText(label),{target:{value}});
  async function select(v,label,name){fireEvent.mouseDown(await v.findByRole('combobox',{name:label},{timeout:10000}));fireEvent.click(await v.findByRole('option',{name}));}
  async function done(v,text){await waitFor(()=>assert.ok(v.container.textContent.includes(text)&&v.container.querySelector('[role=tablist]')),{timeout:10000});}
  let v=await open('/admin/settlement');
  enter(v,/시험 시설명/,'가상 검증 주차장');enter(v,/시험 운영사명/,'가상 검증 운영사');fireEvent.click(v.getByRole('button',{name:'시험 시설 등록'}));await done(v,'시험 시설을 등록했습니다.');
  await select(v,'이용·정산 대상 시설',/가상 검증 주차장/);fireEvent.click(v.getByRole('button',{name:'계약 버전 추가'}));await done(v,'새 요금 계약 버전을 등록했습니다.');
  fireEvent.click(v.getByRole('tab',{name:'코인·이용·환불'}));fireEvent.click(v.getByRole('button',{name:'시험 코인 발급'}));await done(v,'시험 코인을 발급했습니다.');
  enter(v,'시험 이용시간 · 분','30');fireEvent.click(v.getByRole('button',{name:'견적 생성'}));await done(v,'서버 요금 계약으로 견적을 생성했습니다.');
  fireEvent.click(v.getByRole('button',{name:'시험 코인으로 결제'}));await done(v,'시험 결제·배분·전표를 함께 기록했습니다.');
  await tail;
  const payment=(await db.query('select p.gross::text,p.commission::text,p.net::text,q.relation from finance_private.payments p join finance_private.quotes q on q.id=p.quote_id')).rows[0];
  assert.deepEqual(payment,{gross:'1000',commission:'100',net:'900',relation:'unaffiliated'});
  fireEvent.click(v.getByRole('tab',{name:'회계·ERP 교환'}));fireEvent.click(v.getByRole('button',{name:'교환 파일 생성·자체 ERP 전송'}));await done(v,'교환 파일을 생성하고 자체 ERP 승인 대기함에 전송했습니다.');
  v=await open('/admin/erp');assert.equal(v.getByRole('button',{name:'대사 후 장부 반영'}).disabled,true,'preparer cannot self-approve');
  cleanup();state.actor=reviewer;v=await open('/admin/erp');fireEvent.click(v.getByRole('button',{name:'대사 후 장부 반영'}));await done(v,'자체 ERP 장부 반영과 원천 수신 확인을 함께 완료했습니다.');
  await tail;const totals=(await db.query("select count(*)::int n from erp_private.vouchers where status='posted'")).rows[0];assert.equal(totals.n,2);
  fireEvent.click(v.getByRole('tab',{name:'회계 보고서'}));await done(v,'합계잔액 시산표');assert.ok(v.container.textContent.includes('100'));
  const posted=(await db.query("select status from finance_private.exports")).rows;assert.equal(posted[0].status,'erp_posted');
  mkdirSync(new URL('../../artifacts/',import.meta.url),{recursive:true});writeFileSync(new URL('../../artifacts/finance-ui-journey.json',import.meta.url),JSON.stringify({result:'passed',scope:'React jsdom + disposable PostgreSQL/WASM; mocked Auth/Data API; no bank or device',payment,postedVouchers:totals.n,trace},null,2));
 } finally {cleanup();await tail;state.rpcExecutor=null;await db.close();}
});

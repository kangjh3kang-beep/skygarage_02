// React workbench + real disposable SQL; fixture Auth is not hosted acceptance.
import { state,reset } from './browser-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { growthDatabase } from '../helpers/growth-database.mjs';
const React=await import('react');
const {render,cleanup,fireEvent,waitFor,within}=await import('@testing-library/react');
const {default:App}=await import('../../src/App.tsx');
function connect(db){
 state.rpcExecutor=async(name,args,actor)=>{try{return {data:await db.call(actor,name,args),error:null};}catch(e){return {data:null,error:{message:e.message,code:e.code}};}};
 state.tableExecutor=async(name,{single},actor)=>{const rows=name==='user_roles'?(await db.as(actor,'select role,display_name from public.user_roles where user_id=$1',[actor])).rows:[];return {data:single?rows[0]??null:rows,error:null,count:rows.length};};
}
async function select(v,label,name){fireEvent.mouseDown(v.getByRole('combobox',{name:label}));fireEvent.click(await v.findByRole('option',{name}));}
async function open(db,actor){cleanup();state.actor=actor;window.history.replaceState({},'','/admin/governance');const v=render(React.createElement(App));await v.findByRole('combobox',{name:'검증할 현장'});await waitFor(()=>assert.equal(v.getByRole('combobox',{name:'검증할 현장'}).getAttribute('aria-disabled'),null));await select(v,'검증할 현장',/SYNTHETIC site A/);await v.findByText('성장·피드백 실행 현황');return v;}
function cardFor(v,title){return v.getByText(title).closest('.MuiCard-root');}

test('growth UI starts once after lost response, discovers retest, independently reviews and closes',async()=>{
 reset();const db=await growthDatabase();connect(db);try{
  const id=await db.create('SYNTHETIC UI growth task');let v=await open(db,db.ids.manager);
  const base=state.rpcExecutor;let lose=true;state.rpcExecutor=async(name,args,actor)=>{const r=await base(name,args,actor);if(name==='platform_transition_improvement_v2'&&lose&&!r.error){lose=false;return {data:null,error:{message:'synthetic lost response'}};}return r;};
  fireEvent.click(await v.findByRole('button',{name:'개선 시작'}));await v.findByText(/처리 결과를 확인하지 못했습니다/);
  fireEvent.click(v.getByRole('button',{name:'개선 시작'}));await v.findByRole('button',{name:'재검증 증거 찾기'});
  const calls=state.calls.filter(c=>c.name==='platform_transition_improvement_v2');assert.equal(calls.length,2);assert.equal(calls[0].payload.p_request_id,calls[1].payload.p_request_id);
  state.rpcExecutor=base;const evidence=await db.proof();fireEvent.click(v.getByRole('button',{name:'재검증 증거 찾기'}));await v.findByRole('combobox',{name:'이 과제의 유효한 재시험'});await select(v,'이 과제의 유효한 재시험',/SYNTHETIC disposable database only/);fireEvent.click(v.getByRole('button',{name:'검수 요청'}));await v.findByRole('button',{name:'독립 검수 후 완료'});
  assert.equal(v.getByRole('button',{name:'독립 검수 후 완료'}).disabled,true);
  v=await open(db,db.ids.otherManager);await v.findByLabelText('독립 검수 의견 · 링크·해시·전체 조건 대조');fireEvent.change(v.getByLabelText('독립 검수 의견 · 링크·해시·전체 조건 대조'),{target:{value:'SYNTHETIC independent artifact check'}});fireEvent.click(v.getByRole('button',{name:'검수 승인'}));await v.findByText(/검수 의견: SYNTHETIC independent artifact check/);
  fireEvent.click(v.getByRole('button',{name:'독립 검수 후 완료'}));await v.findByText('등록된 과제가 없습니다.');
  await select(v,'과제 상태','완료');await v.findByText('SYNTHETIC UI growth task');assert.match(cardFor(v,'SYNTHETIC UI growth task').textContent,/완료/);
  const stored=(await db.pg.query('select status,resolution_evidence_id from platform_private.improvement_items where id=$1',[id])).rows[0];assert.equal(stored.status,'closed');assert.equal(stored.resolution_evidence_id,evidence);
 }finally{cleanup();state.rpcExecutor=null;state.tableExecutor=null;await db.close();}
});

test('growth filters suppress late private results and refresh failures hide stale records',async()=>{
 reset();const db=await growthDatabase();connect(db);try{
  await db.create('SYNTHETIC PRIVATE F01 item');const base=state.rpcExecutor;let finish;
  state.rpcExecutor=async(name,args,actor)=>name==='platform_growth_loop_snapshot'&&!args.p_requirement_id?new Promise(resolve=>{finish=resolve;}):base(name,args,actor);
  const v=await open(db,db.ids.manager);await waitFor(()=>assert.equal(typeof finish,'function'));
  await select(v,'조회 요구사항',/^F02 ·/);await v.findByText('등록된 과제가 없습니다.');
  finish(await base('platform_growth_loop_snapshot',{p_scope_id:db.scope},db.ids.manager));await waitFor(()=>assert.equal(v.queryByText('SYNTHETIC PRIVATE F01 item'),null));
  state.rpcExecutor=base;await select(v,'조회 요구사항','전체 요구사항');await v.findByText('SYNTHETIC PRIVATE F01 item');
  state.rpcExecutor=async(name,args,actor)=>name==='platform_growth_loop_snapshot'?{data:null,error:{message:'site_access_denied'}}:base(name,args,actor);
  fireEvent.click(v.getByRole('button',{name:'루프 새로 조회'}));await v.findByText(/이 현장의 권한이 없거나 회수되었습니다/);assert.equal(v.queryByText('SYNTHETIC PRIVATE F01 item'),null);
 }finally{cleanup();state.rpcExecutor=null;state.tableExecutor=null;await db.close();}
});

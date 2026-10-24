// Real React + disposable SQL. Auth, SMS and transport are explicit local fixtures.
import { state,reset } from './browser-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceRequestDatabase } from '../helpers/service-request-database.mjs';
const React=await import('react');
const {render,cleanup,fireEvent,waitFor,within}=await import('@testing-library/react');
const {default:App}=await import('../../src/App.tsx');
const enter=(v,label,value)=>fireEvent.change(v.getByLabelText(label),{target:{value}});
async function open(path){cleanup();window.history.replaceState({},'',path);return render(React.createElement(App));}
function connect(db){
 state.rpcExecutor=async(name,args,actor)=>{try{return {data:await db.call(actor,name,args),error:null};}catch(e){return {data:null,error:{message:e.message,code:e.code}};}};
 state.tableExecutor=async(name,{single},actor)=>{
  let rows=[];
  if(name==='sgp_users')rows=(await db.as(actor,'select id,is_verified,display_name,phone_verified_at,status from public.sgp_users where id=$1',[actor],'aal1')).rows;
  if(name==='user_roles')rows=(await db.as(actor,'select role,display_name from public.user_roles where user_id=$1',[actor])).rows;
  if(name==='platform_site_members')rows=(await db.as(actor,"select m.site_id,m.unit_label,m.status,jsonb_build_object('id',s.id,'name',s.name,'phase',s.phase) site from public.platform_site_members m join public.platform_sites s on s.id=m.site_id where m.user_id=$1 and m.status='active'",[actor],'aal1')).rows;
  if(name==='platform_resident_vehicles')rows=(await db.as(actor,"select id,plate,model,status from public.platform_resident_vehicles where user_id=$1 and status='verified'",[actor],'aal1')).rows;
  return {data:single?rows[0]??null:rows,error:null,count:rows.length};
 };
}
async function enroll(db,member,site,manager){const invite=await db.command(manager,'issue_invite',{site_id:site,days:1,max_uses:5});const app=await db.command(member,'apply',{code:invite.code,unit_label:'SYNTHETIC UI household'});await db.command(manager,'review',{site_id:site,id:app.id,expected_revision:1,decision:'approved',reason:'Synthetic qualification verified'});}
test('member UI → chosen site → staff assignment/deadline → review → lost final response retry → own answer',async()=>{
 reset();const db=await serviceRequestDatabase();const {ids:i}=db;connect(db);
 try{
  await enroll(db,i.member,i.siteA,i.manager);state.actor=i.member;
  let v=await open('/app/profile');await v.findByRole('button',{name:'요청 접수하기'});
  await waitFor(()=>assert.equal(v.getByRole('button',{name:'요청 접수하기'}).disabled,true));
  fireEvent.change(v.getByLabelText('요청할 현장'),{target:{value:i.siteA}});enter(v,'제목','SYNTHETIC UI request');enter(v,'요청 내용','SYNTHETIC UI request details');
  await waitFor(()=>assert.equal(v.getByRole('button',{name:'요청 접수하기'}).disabled,false));
  const base=state.rpcExecutor;let lostSubmit=true;
  state.rpcExecutor=async(name,args,actor)=>{const result=await base(name,args,actor);if(name==='sgp_submit_service_request'&&!result.error&&lostSubmit){lostSubmit=false;return {data:null,error:{message:'synthetic lost response'}};}return result;};
  fireEvent.click(v.getByRole('button',{name:'요청 접수하기'}));await v.findByText(/최신 내역을 먼저 확인하세요/);
  fireEvent.click(v.getByRole('button',{name:'요청 접수하기'}));await v.findByText(/서버에 접수되었습니다/);
  const submits=state.calls.filter(c=>c.name==='sgp_submit_service_request');assert.equal(submits.length,2);assert.equal(submits[0].payload.p_client_request_id,submits[1].payload.p_client_request_id);
  const id=(await db.own(i.member)).rows[0].id;
  state.rpcExecutor=base;state.actor=i.manager;state.role='operator';v=await open(`/admin/tickets?site=${i.siteA}`);
  const detailButton=()=>v.getByRole('button',{name:'SYNTHETIC UI request 상세·배정·답변'});
  await v.findByRole('button',{name:'SYNTHETIC UI request 상세·배정·답변'});fireEvent.click(detailButton());
  let dialog=await v.findByRole('dialog');await within(dialog).findByLabelText('배정할 담당자');
  fireEvent.mouseDown(within(dialog).getByRole('combobox',{name:'배정할 담당자'}));fireEvent.click(await v.findByRole('option',{name:'SYNTHETIC manager (본인)'}));
  enter(v,'변경 사유(5~500자)','Synthetic UI owner assigned');
  const due=new Date(Date.now()+3600000);enter(v,'운영 목표 기한(현재 기기 시간)',new Date(due.getTime()-due.getTimezoneOffset()*60000).toISOString().slice(0,16));
  fireEvent.click(within(dialog).getByRole('button',{name:'담당자·목표 기한 저장'}));await waitFor(()=>assert.ok(v.queryByRole('dialog')===null));
  fireEvent.click(await v.findByRole('button',{name:'SYNTHETIC UI request 상세·배정·답변'}));dialog=await v.findByRole('dialog');await within(dialog).findByLabelText('변경 사유(5~500자)');enter(v,'변경 사유(5~500자)','Synthetic review started');fireEvent.click(within(dialog).getByRole('button',{name:'검토 시작 확정'}));await waitFor(()=>assert.ok(v.queryByRole('dialog')===null));
  fireEvent.click(await v.findByRole('button',{name:'SYNTHETIC UI request 상세·배정·답변'}));dialog=await v.findByRole('dialog');await within(dialog).findByLabelText('회원에게 표시할 답변(최대 2000자)');
  enter(v,'변경 사유(5~500자)','Synthetic final response checked');enter(v,'회원에게 표시할 답변(최대 2000자)','Synthetic member answer');
  let lostFinal=true;state.rpcExecutor=async(name,args,actor)=>{const r=await base(name,args,actor);if(name==='platform_service_request_command'&&args.p_action==='review'&&args.p_payload.status==='resolved'&&!r.error&&lostFinal){lostFinal=false;return {data:null,error:{message:'synthetic lost final response'}};}return r;};
  fireEvent.click(within(dialog).getByRole('button',{name:'답변 처리 확정'}));await within(dialog).findByText(/처리 결과를 확인하지 못했습니다/);
  fireEvent.click(within(dialog).getByRole('button',{name:'답변 처리 확정'}));await waitFor(()=>assert.ok(v.queryByRole('dialog')===null));
  const finals=state.calls.filter(c=>c.name==='platform_service_request_command'&&c.payload.p_payload.status==='resolved');assert.equal(finals.length,2);assert.equal(finals[0].payload.p_request_id,finals[1].payload.p_request_id);
  assert.equal((await db.call(i.manager,'platform_service_request_detail',{p_id:id,p_site_id:i.siteA})).history.length,4);
  state.rpcExecutor=base;state.actor=i.member;v=await open('/app/requests');await v.findByText('Synthetic member answer');await v.findByText(/SYNTHETIC site A · 목표 기한/);
  assert.equal(state.calls.some(c=>c.kind==='table'&&c.mutation),false);
 }finally{cleanup();state.rpcExecutor=null;state.tableExecutor=null;await db.close();}
});
test('site switch discards old request data and a failed refresh hides the previous list',async()=>{
 reset();const db=await serviceRequestDatabase();const {ids:i}=db;connect(db);state.actor=i.hq;
 try{
  await enroll(db,i.member,i.siteA,i.manager);await enroll(db,i.otherMember,i.siteB,i.otherManager);await db.submit(i.member,i.siteA,undefined,'SYNTHETIC A PRIVATE');await db.submit(i.otherMember,i.siteB,undefined,'SYNTHETIC B REQUEST');
  const base=state.rpcExecutor;let finish;state.rpcExecutor=async(name,args,actor)=>name==='platform_service_request_snapshot'&&args.p_site_id===i.siteA?new Promise(resolve=>{finish=resolve;}):base(name,args,actor);
  const v=await open(`/admin/tickets?site=${i.siteA}`);await waitFor(()=>assert.equal(typeof finish,'function'));
  fireEvent.mouseDown(v.getByRole('combobox',{name:'관리할 요청함'}));fireEvent.click(await v.findByRole('option',{name:'SYNTHETIC site B'}));await v.findByText('SYNTHETIC B REQUEST');
  finish(await base('platform_service_request_snapshot',{p_site_id:i.siteA,p_status:'open',p_after:null},i.hq));await waitFor(()=>assert.ok(v.queryByText('SYNTHETIC A PRIVATE')===null));
  state.rpcExecutor=async(name,args,actor)=>name==='platform_service_request_snapshot'?{data:null,error:{message:'site_access_denied'}}:base(name,args,actor);
  fireEvent.click(v.getByRole('button',{name:'요청함 새로 조회'}));await v.findByText(/이전 요청 목록은 표시하지 않습니다/);assert.ok(v.queryByText('SYNTHETIC B REQUEST')===null);
 }finally{cleanup();state.rpcExecutor=null;state.tableExecutor=null;await db.close();}
});
test('headquarters UI confirms target disclosure and safely retries a routed request after a lost response',async()=>{
 reset();const db=await serviceRequestDatabase();const {ids:i}=db;connect(db);
 try{
  await enroll(db,i.member,i.siteA,i.manager);const id=await db.submit(i.member,null,undefined,'SYNTHETIC route request');state.actor=i.hq;
  const v=await open('/admin/tickets');fireEvent.click(await v.findByRole('button',{name:'SYNTHETIC route request 상세·배정·답변'}));const dialog=await v.findByRole('dialog');await within(dialog).findByLabelText('변경 사유(5~500자)');
  const routeButton=()=>within(dialog).getByRole('button',{name:'확인한 현장에 요청 연결'});assert.equal(routeButton().disabled,true);
  enter(v,'변경 사유(5~500자)','Synthetic site disclosure checked');fireEvent.mouseDown(within(dialog).getByRole('combobox',{name:'연결할 현장'}));fireEvent.click(await v.findByRole('option',{name:'SYNTHETIC site A'}));assert.equal(routeButton().disabled,true);
  fireEvent.click(within(dialog).getByRole('checkbox',{name:'요청자의 이용 현장과 내용 공개 범위를 확인했습니다'}));assert.equal(routeButton().disabled,false);
  const base=state.rpcExecutor;let lost=true;state.rpcExecutor=async(name,args,actor)=>{const r=await base(name,args,actor);if(name==='platform_service_request_command'&&args.p_action==='route'&&!r.error&&lost){lost=false;return {data:null,error:{message:'synthetic lost route response'}};}return r;};
  fireEvent.click(routeButton());await within(dialog).findByText(/처리 결과를 확인하지 못했습니다/);fireEvent.click(routeButton());await waitFor(()=>assert.ok(v.queryByRole('dialog')===null));await v.findByText('선택한 조건의 요청이 없습니다.');
  const detail=await db.call(i.manager,'platform_service_request_detail',{p_id:id,p_site_id:i.siteA});assert.equal(detail.request.site_id,i.siteA);assert.equal(detail.history.filter(h=>h.action==='route').length,1);
 }finally{cleanup();state.rpcExecutor=null;state.tableExecutor=null;await db.close();}
});

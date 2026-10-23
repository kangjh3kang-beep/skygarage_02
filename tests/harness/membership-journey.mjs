// Real React + actual disposable SQL. Auth/SMS/transport are synthetic fixtures.
import { state,reset } from './browser-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { membershipDatabase } from '../helpers/membership-database.mjs';
const React=await import('react');
const {render,cleanup,waitFor,fireEvent,within}=await import('@testing-library/react');
const {default:App}=await import('../../src/App.tsx');
const {default:Enrollment}=await import('../../src/sgp/components/MemberEnrollment.tsx');
const enter=(v,label,value)=>fireEvent.change(v.getByLabelText(label),{target:{value}});
async function open(path){cleanup();window.history.replaceState({},'',path);const v=render(React.createElement(App));await v.findByRole('combobox',{name:'관리할 현장'},{timeout:10000});return v;}
function executor(db){return async(name,payload={},actor)=>{try{return {data:await db.call(actor,name,payload),error:null};}catch(e){return {data:null,error:{message:e.message,code:e.code}};}};}
test('UI → site profile → invite → own application → approval → member revocation → own history',async()=>{
 reset();const db=await membershipDatabase();const {ids:i}=db;state.actor=i.hq;state.rpcExecutor=executor(db);
 try{
  let v=await open(`/admin/complexes?site=${i.siteA}`);
  await v.findByLabelText('현장 주소');
  console.log('MEMBERSHIP_UI profile loaded');
  enter(v,'현장 주소','Synthetic UI address');enter(v,'운영 안내 시간','Synthetic 09:00–18:00');
  fireEvent.click(v.getByRole('button',{name:'운영 안내정보 저장'}));
  await waitFor(()=>assert.equal(v.getByLabelText('현장 주소').value,'Synthetic UI address'));
  await waitFor(async()=>assert.equal((await db.call(i.hq,'platform_membership_snapshot',{p_site_id:i.siteA})).profile.revision,1));
  fireEvent.click(await v.findByRole('button',{name:'초대코드',exact:true}));await v.findByRole('button',{name:'초대코드 발급'});
  fireEvent.click(v.getByRole('button',{name:'초대코드 발급'}));
  let code;await waitFor(()=>{code=v.container.textContent.match(/\b[0-9a-f]{64}\b/)?.[0];assert.ok(code);});
  console.log('MEMBERSHIP_UI invite issued');
  cleanup();state.actor=i.member;
  v=render(React.createElement(Enrollment,{key:i.member,userId:i.member,verified:true}));
  await v.findByText('신청 내역이 없습니다.');enter(v,'현장 초대코드',code);enter(v,'동·호 또는 이용 구분','SYNTHETIC 101');
  fireEvent.click(v.getByRole('button',{name:'현장 소속 신청'}));await v.findByText(/신청이 접수됐습니다/);
  await waitFor(()=>assert.match(v.container.textContent,/승인 대기/));
  console.log('MEMBERSHIP_UI application pending');
  assert.equal((await db.as(i.member,'select id from public.platform_sites')).rows.length,0);
  cleanup();state.actor=i.hq;
  v=await open(`/admin/residents?site=${i.siteA}`);fireEvent.click(await v.findByRole('button',{name:'소속 승인'}));
  console.log('MEMBERSHIP_UI approval dialog');
  assert.equal(v.getByRole('button',{name:'처리 확정'}).disabled,true);
  enter(v,'처리 사유(5~500자)','Synthetic residency reviewed');fireEvent.click(v.getByRole('button',{name:'처리 확정'}));
  await waitFor(()=>assert.ok(v.queryByRole('dialog')===null));
  fireEvent.click(await v.findByRole('button',{name:'회원 목록',exact:true}));fireEvent.click(await v.findByRole('button',{name:'소속 회수'}));
  console.log('MEMBERSHIP_UI revoke dialog');
  enter(v,'처리 사유(5~500자)','Synthetic move-out reviewed');fireEvent.click(v.getByRole('button',{name:'처리 확정'}));
  await waitFor(()=>assert.ok(v.queryByRole('dialog')===null));
  await waitFor(()=>assert.match(v.container.textContent,/소속 회수/));
  assert.equal((await db.as(i.member,'select id from public.platform_sites')).rows.length,0);
  cleanup();state.actor=i.member;v=render(React.createElement(Enrollment,{key:i.member,userId:i.member,verified:true}));
  await waitFor(()=>assert.match(v.container.textContent,/SYNTHETIC site A/));await waitFor(()=>assert.match(v.container.textContent,/소속 회수/));
  assert.equal(state.calls.some(c=>c.kind==='table'&&c.mutation),false,'all business mutations use guarded RPCs');
 }finally{cleanup();state.rpcExecutor=null;await db.close();}
});
test('a late site response and a failed refresh never expose the previous site list',async()=>{
 reset();const db=await membershipDatabase();const {ids:i}=db;state.actor=i.hq;
 const invite=await db.command(i.otherManager,'issue_invite',{site_id:i.siteB,days:1,max_uses:10});
 await db.command(i.otherMember,'apply',{code:invite.code,unit_label:'SYNTHETIC B UNIT'});
 let finish;const base=executor(db);
 state.rpcExecutor=async(name,args,actor)=>name==='platform_membership_snapshot'&&args.p_site_id===i.siteA?new Promise(resolve=>{finish=resolve;}):base(name,args,actor);
 try{
  const v=await open(`/admin/residents?site=${i.siteA}`);await waitFor(()=>assert.equal(typeof finish,'function'));
  fireEvent.mouseDown(v.getByRole('combobox',{name:'관리할 현장'}));fireEvent.click(await v.findByRole('option',{name:/SYNTHETIC site B/}));
  await v.findByText(/SYNTHETIC B UNIT/);
  finish(await base('platform_membership_snapshot',{p_site_id:i.siteA,p_kind:'requests',p_status:'pending',p_after:null},i.hq));
  await waitFor(()=>assert.match(v.container.textContent,/SYNTHETIC B UNIT/));
  state.rpcExecutor=async(name,args,actor)=>name==='platform_membership_snapshot'?{data:null,error:{code:'42501',message:'site_access_denied'}}:base(name,args,actor);
  fireEvent.click(v.getByRole('button',{name:'현장 정보 새로 조회'}));await v.findByText(/이전 목록은 표시하지 않습니다/);
  assert.doesNotMatch(v.container.textContent,/SYNTHETIC B UNIT/);
 }finally{cleanup();state.rpcExecutor=null;await db.close();}
});
test('registered unit workflow rejects a stale selection, recovers and links the canonical household',async()=>{
 reset();const db=await membershipDatabase();const {ids:i}=db;state.actor=i.manager;state.role='operator';const base=executor(db);state.rpcExecutor=base;
 const reason='Synthetic reviewed registration documents';
 try{
  let v=await open(`/admin/complexes?site=${i.siteA}`);
  const menus=await v.findAllByRole('navigation',{name:'관리자 메뉴'});
  await within(menus[0]).findByText('단지 관리',{exact:true});
  await v.findByLabelText('새 건물명');enter(v,'새 건물명','SYNTHETIC UI 101');
  fireEvent.click(v.getByRole('button',{name:'건물 등록',exact:true}));
  fireEvent.click(await v.findByRole('button',{name:'SYNTHETIC UI 101 · 사용 중',exact:true}));
  enter(v,'새 세대명','501호');
  fireEvent.click(await v.findByRole('button',{name:'세대 등록',exact:true}));
  await v.findByText('501호 · 사용 중 · 활성 소속 0명');
  enter(v,'원장 변경 사유(5~500자)',reason);
  fireEvent.click(v.getByRole('button',{name:'등록 세대 필수로 변경'}));
  await v.findByText(/승인 방식: 등록 세대 필수/);
  const invite=await db.command(i.hq,'issue_invite',{site_id:i.siteA,days:1,max_uses:10});
  cleanup();state.actor=i.member;
  v=render(React.createElement(Enrollment,{key:i.member,userId:i.member,verified:true}));
  await v.findByText('신청 내역이 없습니다.');enter(v,'현장 초대코드',invite.code);enter(v,'동·호 또는 이용 구분','SYNTHETIC claimed 999');
  fireEvent.click(v.getByRole('button',{name:'현장 소속 신청'}));await v.findByText(/신청이 접수됐습니다/);
  cleanup();state.actor=i.manager;v=await open(`/admin/residents?site=${i.siteA}`);
  fireEvent.click(await v.findByRole('button',{name:'소속 승인'}));enter(v,'처리 사유(5~500자)',reason);
  assert.equal(v.getByRole('button',{name:'처리 확정'}).disabled,true);
  async function choose(){
   fireEvent.mouseDown(await v.findByRole('combobox',{name:'승인할 등록 건물'}));fireEvent.click(await v.findByRole('option',{name:'SYNTHETIC UI 101',exact:true}));
   fireEvent.mouseDown(await v.findByRole('combobox',{name:'승인할 등록 세대'}));fireEvent.click(await v.findByRole('option',{name:'501호',exact:true}));
  }
  await choose();
  const building=(await db.call(i.hq,'platform_residence_directory',{p_site_id:i.siteA})).rows[0];
  const unit=(await db.call(i.hq,'platform_residence_directory',{p_site_id:i.siteA,p_building_id:building.id})).rows[0];
  let interrupted=false;
  state.rpcExecutor=async(name,args,actor)=>{
   if(name==='platform_membership_command'&&args.p_action==='review'&&!interrupted){interrupted=true;await db.command(i.hq,'set_unit_active',{site_id:i.siteA,id:unit.id,expected_revision:1,active:false,reason});}
   return base(name,args,actor);
  };
  fireEvent.click(v.getByRole('button',{name:'처리 확정'}));
  await v.findByText(/해당 현장에서 사용 중인 세대를 선택하세요/);
  assert.equal((await db.call(i.hq,'platform_membership_snapshot',{p_site_id:i.siteA})).rows[0].status,'pending');
  await db.command(i.hq,'set_unit_active',{site_id:i.siteA,id:unit.id,expected_revision:2,active:true,reason});
  fireEvent.click(v.getByRole('button',{name:'등록 건물·세대 새로 조회'}));
  assert.equal(v.getByRole('button',{name:'처리 확정'}).disabled,true);
  await choose();fireEvent.click(v.getByRole('button',{name:'처리 확정'}));
  await waitFor(()=>assert.ok(v.queryByRole('dialog')===null));
  fireEvent.click(await v.findByRole('button',{name:'회원 목록',exact:true}));
  await v.findByText('SYNTHETIC member · SYNTHETIC UI 101 501호');
  await v.findByText('등록 세대 원장에 연결됨');
  const own=await db.call(i.member,'platform_my_memberships');assert.equal(own.memberships[0].unit_id,unit.id);
  assert.equal(own.applications[0].unit_label,'SYNTHETIC claimed 999','the original claim remains in request history');
  assert.equal(state.calls.some(c=>c.kind==='table'&&c.mutation),false);
 }finally{cleanup();state.rpcExecutor=null;await db.close();}
});
test('member exit UI confirms one site, rejects revoked sessions and safely retries a lost response',async()=>{
 reset();const db=await membershipDatabase();const {ids:i,pg,sessionIds}=db;state.actor=i.member;state.role='resident';state.aal='aal1';
 const base=executor(db);state.rpcExecutor=base;let reloads=0;
 try{
  for(const [site,manager] of [[i.siteA,i.manager],[i.siteB,i.otherManager]]){
   const invite=await db.command(manager,'issue_invite',{site_id:site,days:1,max_uses:5});
   const app=await db.command(i.member,'apply',{code:invite.code,unit_label:'SYNTHETIC exit UI'});
   await db.command(manager,'review',{site_id:site,id:app.id,expected_revision:1,decision:'approved',reason:'Synthetic UI qualification checked'});
  }
  const v=render(React.createElement(Enrollment,{key:i.member,userId:i.member,verified:true,onMembershipChange:()=>reloads++}));
  const start=await v.findByRole('button',{name:'SYNTHETIC site A 소속 해지'});
  fireEvent.click(start);let panel=v.getByRole('region',{name:'현장 소속 해지 확인'});
  assert.equal(within(panel).getByRole('button',{name:'소속 해지 확정'}).disabled,true);
  enter(v,'소속 해지 확인 문구','확인');assert.equal(within(panel).getByRole('button',{name:'소속 해지 확정'}).disabled,true);
  fireEvent.click(within(panel).getByRole('button',{name:'해지 취소'}));
  assert.ok(v.queryByRole('region',{name:'현장 소속 해지 확인'})===null);
  assert.equal(state.calls.filter(c=>c.payload?.p_action==='leave').length,0);
  fireEvent.click(start);enter(v,'소속 해지 확인 문구','소속 해지');
  await pg.query('delete from auth.sessions where id=$1',[sessionIds[i.member]]);
  fireEvent.click(v.getByRole('button',{name:'소속 해지 확정'}));await v.findByText(/로그인 세션을 확인할 수 없습니다/);
  assert.equal((await db.call(i.member,'platform_my_memberships')).memberships.find(x=>x.site_id===i.siteA).status,'active');
  // A new local synthetic session stands in for reauthentication; no hosted login is claimed.
  await pg.query('insert into auth.sessions(id,user_id) values($1,$2)',[sessionIds[i.member],i.member]);
  let lose=true;
  state.rpcExecutor=async(name,args,actor)=>{
   const result=await base(name,args,actor);
   if(name==='platform_membership_command'&&args.p_action==='leave'&&!result.error&&lose){lose=false;return {data:null,error:{message:'synthetic lost response'}};}
   return result;
  };
  fireEvent.click(v.getByRole('button',{name:'소속 해지 확정'}));await v.findByText(/처리 결과를 확인하지 못했습니다/);
  fireEvent.click(v.getByRole('button',{name:'소속 해지 확정'}));await v.findByText(/선택한 현장의 소속과 등록 차량 권한을 해지했습니다/);
  await waitFor(()=>assert.ok(v.queryByRole('button',{name:'SYNTHETIC site A 소속 해지'})===null));
  assert.ok(v.getByRole('button',{name:'SYNTHETIC site B 소속 해지'}));assert.equal(reloads,1);
  assert.ok(v.queryByRole('region',{name:'현장 소속 해지 확인'})===null);
  const calls=state.calls.filter(c=>c.payload?.p_action==='leave');assert.equal(calls.length,3);assert.equal(new Set(calls.map(c=>c.payload.p_request_id)).size,1);
  assert.equal((await pg.query("select count(*)::int n from platform_private.membership_events where action='leave'")).rows[0].n,1);
 }finally{cleanup();state.rpcExecutor=null;await db.close();}
});

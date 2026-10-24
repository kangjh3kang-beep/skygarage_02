import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { serviceRequestDatabase } from './helpers/service-request-database.mjs';
test('service request routing, assignment, deadline, reply and immutable audit enforce site and session scope',async()=>{
 const db=await serviceRequestDatabase();const {pg,ids:i,submit,act,snapshot,own,call,as,command}=db;
 const reason='Synthetic operating decision';
 try{
  const key=randomUUID(),id=await submit(i.member,null,key);
  assert.equal(await submit(i.member,null,key),id);
  await assert.rejects(submit(i.member,null,key,'Changed request'),/idempotency_conflict/);
  for(const session_id of [null,'bad-session',randomUUID(),db.sessionIds[i.otherMember]])await assert.rejects(as(i.member,'select public.platform_my_service_requests()',[],'aal1','authenticated',{session_id}),/reauthentication_required/);
  await assert.rejects(submit(i.unverified),/phone_verification_required/);
  await assert.rejects(submit(i.member,i.siteA),/request_site_unavailable/);
  await assert.rejects(snapshot(i.member),/mfa_required|headquarters_required/);
  await assert.rejects(snapshot(i.manager),/headquarters_required/);
  await assert.rejects(snapshot(i.manager,i.siteB),/site_access_denied/);
  await assert.rejects(call(i.hq,'platform_service_request_snapshot',{},'aal1'),/mfa_required/);
  await assert.rejects(as(null,'select public.platform_my_service_requests()',[],'aal1','anon'),/permission denied/);
  await assert.rejects(as(i.hq,"update public.sgp_service_requests set status='reviewing'"),/permission denied/);
  await assert.rejects(as(i.member,'select * from public.sgp_service_requests'),/permission denied/);
  await assert.rejects(as(i.member,"insert into public.sgp_service_requests(user_id,client_request_id,category,subject,description) values($1,$2,'visit','TEST','TEST details')",[i.member,randomUUID()]),/permission denied/);
  const base={id,site_id:null,expected_revision:1,reason,confirmed:true};
  await assert.rejects(act(i.hq,'route',{...base,target_site_id:i.siteA}),/request_site_unavailable/);
  const invite=await command(i.manager,'issue_invite',{site_id:i.siteA,days:1,max_uses:5});
  const app=await command(i.member,'apply',{code:invite.code,unit_label:'SYNTHETIC 101'});
  await command(i.manager,'review',{site_id:i.siteA,id:app.id,expected_revision:1,decision:'approved',reason});
  const routeKey=randomUUID(),routed=await act(i.hq,'route',{...base,target_site_id:i.siteA},routeKey);
  assert.deepEqual(await act(i.hq,'route',{...base,target_site_id:i.siteA},routeKey),routed,'lost route response can be retried after scope changes');
  assert.equal(await submit(i.member,null,key),id,'receipt retains the original submission scope after routing');
  assert.equal((await snapshot(i.hq)).rows.length,0);assert.equal((await snapshot(i.manager,i.siteA)).rows[0].id,id);
  const viewer=await snapshot(i.viewer,i.siteA);assert.equal(viewer.can_manage,false);
  await assert.rejects(act(i.viewer,'assign',{...base,site_id:i.siteA,expected_revision:2,assignee_id:i.manager}),/site_access_denied/);
  await assert.rejects(act(i.otherManager,'assign',{...base,site_id:i.siteA,expected_revision:2,assignee_id:i.otherManager}),/site_access_denied/);
  await assert.rejects(act(i.manager,'assign',{...base,site_id:i.siteA,expected_revision:1,assignee_id:i.manager}),/version_conflict/);
  const assign={...base,site_id:i.siteA,expected_revision:2,assignee_id:i.manager,due_at:new Date(Date.now()+3600000).toISOString()};
  for(const assignee_id of [i.member,i.viewer,i.otherManager])await assert.rejects(act(i.manager,'assign',{...assign,assignee_id}),/assignee_unavailable/);
  await assert.rejects(act(i.manager,'assign',{...assign,due_at:new Date(Date.now()-1000).toISOString()}),/invalid_due_at/);
  await assert.rejects(act(i.manager,'assign',{...assign,assignee_id:null}),/assignee_required/);
  await assert.rejects(act(i.manager,'assign',{...assign,due_at:new Date(Date.now()+31*86400000).toISOString()}),/invalid_due_at/);
  await assert.rejects(act(i.manager,'assign',{...assign,reason:''}),/reason_required/);
  await act(i.manager,'assign',assign);let rev=3;
  const review={id,site_id:i.siteA,expected_revision:rev,reason,status:'reviewing',response:'Synthetic progress reply'};
  await assert.rejects(act(i.hq,'review',review),/assigned_actor_required/);
  await assert.rejects(act(i.manager,'review',{...review,status:'resolved'}),/invalid_transition/);
  // Downstream event failure must roll back status, audit and receipt.
  await pg.exec("create function platform_private.test_request_failure() returns trigger language plpgsql as $$ begin raise exception 'synthetic_event_failure'; end $$; create trigger synthetic_request_failure before insert on platform_private.service_request_events for each row execute function platform_private.test_request_failure();");
  const retryKey=randomUUID();await assert.rejects(act(i.manager,'review',review,retryKey),/synthetic_event_failure/);
  assert.equal((await snapshot(i.manager,i.siteA)).rows[0].revision,rev);
  assert.equal((await pg.query('select count(*)::int n from platform_private.service_request_commands where request_id=$1',[retryKey])).rows[0].n,0);
  await pg.exec('drop trigger synthetic_request_failure on platform_private.service_request_events;drop function platform_private.test_request_failure()');
  await act(i.manager,'review',review,retryKey);rev++;
  await assert.rejects(act(i.manager,'review',{...review,expected_revision:rev,status:'resolved',response:''}),/response_required/);
  await pg.query("update platform_private.site_staff set active=false where site_id=$1 and user_id=$2",[i.siteA,i.manager]);
  await assert.rejects(act(i.manager,'review',review,retryKey),/site_access_denied/,'even cached receipts require current roles');
  await pg.query("update platform_private.site_staff set active=true where site_id=$1 and user_id=$2",[i.siteA,i.manager]);
  await pg.query('delete from auth.sessions where id=$1',[db.sessionIds[i.manager]]);
  await assert.rejects(act(i.manager,'review',review,retryKey),/reauthentication_required/);
  await pg.query('insert into auth.sessions(id,user_id) values($1,$2)',[db.sessionIds[i.manager],i.manager]);
  const closeKey=randomUUID(),close={...review,expected_revision:rev,status:'resolved',response:'Synthetic final answer'};
  await act(i.manager,'review',close,closeKey);await act(i.manager,'review',close,closeKey);
  await assert.rejects(act(i.manager,'review',{...close,response:'Changed answer'},closeKey),/idempotency_conflict/);
  await assert.rejects(act(i.manager,'assign',{...assign,expected_revision:rev+1}),/request_closed/);
  const mine=(await own(i.member)).rows[0];assert.equal(mine.response,'Synthetic final answer');assert.equal(mine.site_name,'SYNTHETIC site A');assert.equal(mine.overdue,false);
  assert.equal((await own(i.otherMember)).rows.length,0);
  await assert.rejects(call(i.otherManager,'platform_service_request_detail',{p_id:id,p_site_id:i.siteB}),/request_scope_conflict/);
  const detail=await call(i.manager,'platform_service_request_detail',{p_id:id,p_site_id:i.siteA});assert.equal(detail.history[0].action,'review');assert.equal(detail.history.length,5);
  assert.equal((await pg.query("select count(*)::int n from platform_private.audit_events where subject_id=$1",[id])).rows[0].n,5);
  // Independent request at B is never listed or changed by A; all four legacy args still route to HQ.
  const legacy=await call(i.otherMember,'sgp_submit_service_request',{p_client_request_id:randomUUID(),p_category:'visit',p_subject:'SYNTHETIC HQ',p_description:'SYNTHETIC HQ details'},'aal1');
  assert.equal((await snapshot(i.hq)).rows[0].id,legacy);
  const bInvite=await command(i.otherManager,'issue_invite',{site_id:i.siteB,days:1,max_uses:5});const bApp=await command(i.otherMember,'apply',{code:bInvite.code,unit_label:'SYNTHETIC B'});await command(i.otherManager,'review',{site_id:i.siteB,id:bApp.id,expected_revision:1,decision:'approved',reason});
  const b=await submit(i.otherMember,i.siteB);assert.equal((await snapshot(i.otherManager,i.siteB)).rows[0].id,b);
  const rejected=await submit(i.member,i.siteA,randomUUID(),'SYNTHETIC second');
  await act(i.manager,'assign',{id:rejected,site_id:i.siteA,expected_revision:1,assignee_id:i.manager,due_at:new Date(Date.now()+3600000).toISOString(),reason});
  // Fixture-only clock manipulation exposes overdue aggregation; production never receives test rows.
  await pg.exec('alter table public.sgp_service_requests disable trigger all');await pg.query("update public.sgp_service_requests set due_at=now()-interval '1 hour' where id=$1",[rejected]);await pg.exec('alter table public.sgp_service_requests enable trigger all');
  assert.equal((await snapshot(i.manager,i.siteA,'overdue')).counts.overdue,1);assert.equal((await own(i.member)).rows.find(x=>x.id===rejected).overdue,true);
  await act(i.manager,'review',{id:rejected,site_id:i.siteA,expected_revision:2,status:'reviewing',reason});await act(i.manager,'review',{id:rejected,site_id:i.siteA,expected_revision:3,status:'rejected',response:'Synthetic decline explanation',reason});
  assert.equal((await snapshot(i.manager,i.siteA)).counts.overdue,0);
  assert.equal((await snapshot(i.otherManager,i.siteB)).rows[0].revision,1);
  const membership=(await call(i.member,'platform_my_memberships')).memberships.find(m=>m.site_id===i.siteA);
  await command(i.member,'leave',{site_id:i.siteA,expected_revision:membership.revision,reason:'시설 이용 종료',confirmation:'소속 해지'});
  assert.equal((await own(i.member)).rows.find(r=>r.id===id).response,'Synthetic final answer','site exit preserves the owner request history');
  await assert.rejects(submit(i.member,i.siteA),/request_site_unavailable/);
  assert.equal(await submit(i.member,null,key),id,'old receipt cannot restore membership');
  // Keyset pagination with synthetic local owners, not production identities.
  for(let n=0;n<51;n++){
   const user=randomUUID();await pg.query('insert into auth.users(id) values($1)',[user]);
   await as(user,"insert into public.sgp_service_requests(user_id,client_request_id,category,subject,description,site_id) values($1,$2,'visit','SYNTHETIC page','SYNTHETIC page details',$3)",[user,randomUUID(),i.siteA],'aal1','service_role');
  }
  const p1=await snapshot(i.manager,i.siteA,'all');assert.equal(p1.rows.length,50);assert.ok(p1.next_cursor);const p2=await snapshot(i.manager,i.siteA,'all',p1.next_cursor);assert.equal(p2.rows.length,3);assert.equal(new Set([...p1.rows,...p2.rows].map(x=>x.id)).size,53);
 }finally{await db.close();}
});

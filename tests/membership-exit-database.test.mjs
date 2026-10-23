import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { membershipDatabase } from './helpers/membership-database.mjs';
// Synthetic disposable sessions test SQL authorization, not real hosted login/SMS.
test('self-service site exit requires a live own session and atomically preserves other sites/history',async()=>{
 const db=await membershipDatabase();const {pg,ids:i,sessionIds,command,call,as}=db;
 const own=()=>call(i.member,'platform_my_memberships');
 try{
  const applications=[];
  for(const [site,manager] of [[i.siteA,i.manager],[i.siteB,i.otherManager]]){
   const invite=await command(manager,'issue_invite',{site_id:site,days:1,max_uses:10});
   const application=await command(i.member,'apply',{code:invite.code,unit_label:'SYNTHETIC original claim'});
   applications.push({application,invite});
   await command(manager,'review',{site_id:site,id:application.id,expected_revision:1,decision:'approved',reason:'Synthetic residency checked'});
   await pg.query("insert into public.platform_resident_vehicles(site_id,user_id,plate,model,status) values($1,$2,$3,'Synthetic vehicle','verified')",[site,i.member,site===i.siteA?'TEST-A':'TEST-B']);
  }
  const building=await command(i.manager,'create_building',{site_id:i.siteA,label:'SYNTHETIC 101'});
  const unit=await command(i.manager,'create_unit',{site_id:i.siteA,building_id:building.id,label:'501호'});
  let a=(await own()).memberships.find(x=>x.site_id===i.siteA);
  await command(i.manager,'link_member_unit',{site_id:i.siteA,user_id:i.member,unit_id:unit.id,expected_revision:a.revision,reason:'Synthetic household checked'});
  a=(await own()).memberships.find(x=>x.site_id===i.siteA);
  const beforeB=(await own()).memberships.find(x=>x.site_id===i.siteB);
  const payload={site_id:i.siteA,expected_revision:a.revision,reason:'시설 이용 종료',confirmation:'소속 해지'};
  const key=randomUUID();
  const raw=(actor,claims,request=key)=>as(actor,'select public.platform_membership_command($1,$2,$3::jsonb) result',[request,'leave',JSON.stringify(payload)],'aal1','authenticated',claims);
  await assert.rejects(as(null,'select public.platform_membership_command($1,$2,$3::jsonb)',[key,'leave',JSON.stringify(payload)],'aal1','anon'),/permission denied/);
  await assert.rejects(as(i.member,'select platform_private.assert_live_member_session()'),/permission denied/);
  for(const session_id of [null,'bad-session',randomUUID(),sessionIds[i.otherMember]])await assert.rejects(raw(i.member,{session_id}),/reauthentication_required/);
  await pg.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[sessionIds[i.member]]);
  await assert.rejects(command(i.member,'leave',payload,key,'aal1'),/reauthentication_required/);
  await pg.query('update auth.sessions set not_after=null where id=$1',[sessionIds[i.member]]);
  for(const column of ['banned_until','deleted_at']){
   await pg.query(`update auth.users set ${column}=now()+interval '1 hour' where id=$1`,[i.member]);
   await assert.rejects(command(i.member,'leave',payload,key,'aal1'),/reauthentication_required/);
   await pg.query(`update auth.users set ${column}=null where id=$1`,[i.member]);
  }
  await pg.query("update public.sgp_users set status='inactive' where id=$1",[i.member]);
  await assert.rejects(command(i.member,'leave',payload,key,'aal1'),/reauthentication_required/);
  await pg.query("update public.sgp_users set status='active' where id=$1",[i.member]);
  await assert.rejects(command(i.otherMember,'leave',payload),/own_membership_required/);
  await assert.rejects(command(i.member,'leave',{...payload,user_id:i.otherMember}),/own_membership_required/);
  await assert.rejects(command(i.member,'leave',{...payload,confirmation:'확인'}),/membership_confirmation_required/);
  await assert.rejects(command(i.member,'leave',{...payload,reason:''}),/reason_required/);
  await assert.rejects(command(i.member,'leave',{...payload,expected_revision:a.revision-1}),/version_conflict/);
  assert.equal((await own()).memberships.find(x=>x.site_id===i.siteA).status,'active');
  // Inject a downstream failure: the first update, events and receipt all roll back.
  await pg.exec("create function platform_private.test_exit_failure() returns trigger language plpgsql as $$ begin raise exception 'synthetic_vehicle_failure'; end $$; create trigger synthetic_exit_failure before update on public.platform_resident_vehicles for each row execute function platform_private.test_exit_failure();");
  await assert.rejects(command(i.member,'leave',payload,key,'aal1'),/synthetic_vehicle_failure/);
  assert.equal((await own()).memberships.find(x=>x.site_id===i.siteA).status,'active');
  assert.equal((await pg.query('select count(*)::int n from platform_private.membership_commands where request_id=$1',[key])).rows[0].n,0);
  await pg.exec('drop trigger synthetic_exit_failure on public.platform_resident_vehicles; drop function platform_private.test_exit_failure()');
  // Inconsistent legacy pending request must not later re-approve the old exit.
  const stale=randomUUID();await pg.query("insert into platform_private.membership_requests(id,site_id,user_id,invite_id,unit_label) values($1,$2,$3,$4,'SYNTHETIC stale')",[stale,i.siteA,i.member,applications[0].invite.id]);
  await pg.query("update public.platform_sites set phase='suspended' where id=$1",[i.siteA]);
  const receipt=await command(i.member,'leave',payload,key,'aal1');
  assert.deepEqual(await command(i.member,'leave',payload,key,'aal1'),receipt);
  await assert.rejects(command(i.member,'leave',{...payload,reason:'이사·입주 종료'},key,'aal1'),/idempotency_conflict/);
  const after=await own(),left=after.memberships.find(x=>x.site_id===i.siteA);
  assert.equal(left.status,'revoked');assert.equal(left.revision,a.revision+1);assert.equal(left.unit_id,unit.id);
  assert.deepEqual(after.memberships.find(x=>x.site_id===i.siteB),beforeB);
  const vehicles=(await pg.query('select site_id,status from public.platform_resident_vehicles where user_id=$1',[i.member])).rows;
  assert.equal(vehicles.find(x=>x.site_id===i.siteA).status,'revoked');assert.equal(vehicles.find(x=>x.site_id===i.siteB).status,'verified');
  assert.deepEqual((await as(i.member,'select id from public.platform_sites')).rows.map(x=>x.id),[i.siteB]);
  const history=after.applications.find(x=>x.id===applications[0].application.id);assert.equal(history.status,'approved');assert.equal(history.unit_label,'SYNTHETIC original claim');
  assert.equal(after.applications.find(x=>x.id===stale).status,'withdrawn');
  assert.equal((await pg.query('select status from public.sgp_users where id=$1',[i.member])).rows[0].status,'active');
  assert.equal((await pg.query("select count(*)::int n from platform_private.membership_events where action='leave'")).rows[0].n,1);
  assert.equal((await pg.query("select count(*)::int n from platform_private.audit_events where action='membership.leave'")).rows[0].n,1);
  await pg.query('delete from auth.sessions where id=$1',[sessionIds[i.member]]);
  await assert.rejects(command(i.member,'leave',payload,key,'aal1'),/reauthentication_required/,'even cached receipt needs a live session');
  sessionIds[i.member]=randomUUID();await pg.query('insert into auth.sessions(id,user_id) values($1,$2)',[sessionIds[i.member],i.member]);
  await pg.query("update public.platform_sites set phase='sandbox' where id=$1",[i.siteA]);
  const reapply=await command(i.member,'apply',{code:applications[0].invite.code,unit_label:'SYNTHETIC return'});
  await command(i.manager,'review',{site_id:i.siteA,id:reapply.id,expected_revision:1,decision:'approved',reason:'Synthetic return checked'});
  const returned=(await own()).memberships.find(x=>x.site_id===i.siteA);
  await command(i.member,'leave',payload,key,'aal1');
  assert.deepEqual((await own()).memberships.find(x=>x.site_id===i.siteA),returned,'old receipt cannot revoke a newly approved membership');
  await assert.rejects(command(i.member,'leave',payload),/version_conflict/);
  await command(i.member,'leave',{...payload,expected_revision:returned.revision},randomUUID(),'aal1');
 }finally{await db.close();}
});

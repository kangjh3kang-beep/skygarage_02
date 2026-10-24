import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { growthDatabase } from './helpers/growth-database.mjs';
import { parseGrowthLoopSnapshot,parseRetestCandidates } from '../src/lib/growth-loop.ts';


test('governance rejects missing, revoked, foreign, expired sessions and banned accounts',async()=>{
 const d=await growthDatabase();try{
  for(const claims of [{session_id:null},{session_id:'bad'},{session_id:randomUUID()},{session_id:d.sessionIds[d.ids.hq]}])await assert.rejects(d.as(d.ids.manager,'select public.platform_governance_directory()',[],'aal2','authenticated',claims),/reauthentication_required/);
  await assert.rejects(d.call(d.ids.manager,'platform_governance_directory',{},'aal1'),/mfa_required/);
  await d.pg.query('update auth.sessions set not_after=now()-interval \'1 second\' where id=$1',[d.sessionIds[d.ids.manager]]);
  await assert.rejects(d.snap(),/reauthentication_required/);
  await d.pg.query('update auth.sessions set not_after=null where id=$1',[d.sessionIds[d.ids.manager]]);
  await d.pg.query('update auth.users set banned_until=now()+interval \'1 day\' where id=$1',[d.ids.manager]);
  await assert.rejects(d.create(),/reauthentication_required/);
  await d.pg.query('update auth.users set banned_until=null where id=$1',[d.ids.manager]);
  await d.pg.query('delete from auth.sessions where id=$1',[d.sessionIds[d.ids.manager]]);
  await assert.rejects(d.call(d.ids.manager,'platform_governance_snapshot',{p_scope_id:d.scope}),/reauthentication_required/);
 }finally{await d.close();}
});

test('loop lifecycle retries once, rejects stale evidence, enforces current independent reviewer and rolls back audit errors',async()=>{
 const d=await growthDatabase();try{
  const item=await d.create();const key=randomUUID();assert.equal(await d.move(d.ids.manager,item,1,'in_progress',null,key),2);assert.equal(await d.move(d.ids.manager,item,1,'in_progress',null,key),2);
  await assert.rejects(d.move(d.ids.manager,item,2,'verification',null,key),/idempotency_conflict/);
  const old=await d.proof(d.ids.manager,'integration','pass',new Date(Date.now()-3600000).toISOString());
  await assert.rejects(d.move(d.ids.manager,item,2,'verification',old),/new_passing_evidence_required/);
  const future=await d.proof(d.ids.manager,'integration','pass',new Date(Date.now()+60000).toISOString());
  await assert.rejects(d.move(d.ids.manager,item,2,'verification',future),/new_passing_evidence_required/);
  const evidence=await d.proof();
  const candidates=parseRetestCandidates(await d.call(d.ids.manager,'platform_retest_candidates',{p_id:item}));assert.equal(candidates.evidence.some(e=>e.id===old),false);assert.ok(candidates.evidence.some(e=>e.id===evidence));
  assert.equal(await d.move(d.ids.manager,item,2,'verification',evidence),3);
  await assert.rejects(d.move(d.ids.manager,item,3,'closed'),/site_access_denied|independent_reviewer_required/);
  await d.call(d.ids.otherManager,'platform_review_evidence',{p_evidence_id:evidence,p_decision:'approved',p_note:'SYNTHETIC independent review'});
  await d.pg.query('update auth.users set banned_until=now()+interval \'1 day\' where id=$1',[d.ids.otherManager]);
  await assert.rejects(d.move(d.ids.hq,item,3,'closed'),/reviewed_retest_required/);
  await d.pg.query('update auth.users set banned_until=null where id=$1',[d.ids.otherManager]);
  await d.pg.exec("create function platform_private.reject_test_audit() returns trigger language plpgsql as $$ begin raise exception 'synthetic_audit_failure'; end $$; create trigger reject_test_audit before insert on platform_private.audit_events for each row execute function platform_private.reject_test_audit();");
  await assert.rejects(d.move(d.ids.hq,item,3,'closed'),/synthetic_audit_failure/);
  assert.equal((await d.snap()).improvements[0].status,'verification');
  await d.pg.exec('drop trigger reject_test_audit on platform_private.audit_events');
  assert.equal(await d.move(d.ids.hq,item,3,'closed'),4);
  const snapshot=await d.snap();assert.equal(snapshot.counts.closed,1);assert.equal(snapshot.readiness.approved,0);
  assert.equal((await d.pg.query('select count(*)::int n from platform_private.governance_commands')).rows[0].n,3);
 }finally{await d.close();}
});

test('keyset pages reach old records, counts remain global, cross-site cursor and viewer mutations denied',async()=>{
 const d=await growthDatabase();try{
  // 105 archived entries exceed the old UI limit; fixtures never reach a hosted project.
  await d.pg.query("insert into platform_private.improvement_items(scope_id,requirement_id,kind,severity,title,description,request_id,created_by,created_at) select $1,'F01','improvement','normal','SYNTHETIC item '||n,'SYNTHETIC fixture description',gen_random_uuid(),$2,now()-n*interval '1 minute' from generate_series(1,105)n",[d.scope,d.ids.manager]);
  let cursor=null;const seen=new Set();do{const page=await d.snap({p_improvement_before:cursor});assert.equal(page.counts.active,105);assert.equal(page.improvements_total,105);for(const i of page.improvements){assert.ok(!seen.has(i.id));seen.add(i.id);}cursor=page.next_improvement;}while(cursor);assert.equal(seen.size,105);
  assert.equal((await d.snap({p_query:'item 105'})).improvements.length,1);
  await d.pg.query("insert into platform_private.validation_evidence(scope_id,plan_version,requirement_id,request_id,submitted_by,test_kind,environment,result,procedure_version,artifact_uri,artifact_sha256,summary,measured_at,expires_at,created_at) select $1,'2026.10-v1','F01',gen_random_uuid(),$2,'integration','staging','pass','synthetic/v1','https://example.invalid/archive',repeat('c',64),'SYNTHETIC evidence '||n,now()-n*interval '1 minute',now()+interval '1 day',now()-n*interval '1 minute' from generate_series(1,105)n",[d.scope,d.ids.manager]);
  cursor=null;const proofs=new Set();do{const page=await d.snap({p_evidence_before:cursor});assert.equal(page.evidence_total,105);for(const e of page.evidence){assert.ok(!proofs.has(e.id));proofs.add(e.id);}cursor=page.next_evidence;}while(cursor);assert.equal(proofs.size,105);
  const malformed=await d.snap();malformed.counts.pending_reviews='105';assert.throws(()=>parseGrowthLoopSnapshot(malformed));
  const other=await d.call(d.ids.hq,'platform_open_validation_scope',{p_request_id:randomUUID(),p_site_id:d.ids.siteB,p_release_sha:'b'.repeat(40)});
  await assert.rejects(d.call(d.ids.manager,'platform_growth_loop_snapshot',{p_scope_id:other}),/site_access_denied/);
  await assert.rejects(d.call(d.ids.hq,'platform_growth_loop_snapshot',{p_scope_id:other,p_improvement_before:[...seen][0]}),/invalid_loop_cursor/);
  await assert.rejects(d.move(d.ids.viewer,[...seen][0],1,'in_progress'),/site_access_denied/);
  await assert.rejects(d.as(d.ids.manager,'select * from platform_private.governance_commands'),/permission denied/);
  await assert.rejects(d.as(d.ids.manager,'select public.platform_growth_loop_snapshot($1)',[d.scope],'aal2','anon'),/permission denied/);
 }finally{await d.close();}
});

test('a new failure and reviewer revocation invalidate previously accepted evidence',async()=>{
 const d=await growthDatabase();try{
  for(const kind of ['software','integration','acceptance']){const e=await d.proof(d.ids.manager,kind);await d.call(d.ids.otherManager,'platform_review_evidence',{p_evidence_id:e,p_decision:'approved',p_note:'SYNTHETIC verified fixture'});}
  // F01 requires software + integration + acceptance in the pinned catalog.
  const before=await d.snap();assert.equal(before.readiness.requirements.find(r=>r.id==='F01').accepted,true);
  await d.pg.query('update auth.users set deleted_at=now() where id=$1',[d.ids.otherManager]);
  assert.equal((await d.snap()).readiness.approved,0);
  await d.pg.query('update auth.users set deleted_at=null where id=$1',[d.ids.otherManager]);
  const failure=await d.proof(d.ids.manager,'integration','fail');assert.ok(failure);
  const after=await d.snap();assert.equal(after.readiness.approved,0);assert.equal(after.readiness.blocking_defects,1);assert.ok(after.blockers.find(b=>b.id==='F01').missing_kinds.includes('integration'));
 }finally{await d.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateContract, advanceMission, runContractScenario, labScenarios } from '../src/lib/mission-contract.ts';
const scope = {tenantId:'tenant-a',siteId:'site-a',deviceId:'device-a'};
const input=()=>({expected:scope,command:{...scope,id:'command-a',digest:'sha256:example',issuedAt:90000,expiresAt:110000,fence:4},now:100000,lease:{fence:4,expiresAt:120000},heartbeatAt:99999,safety:'clear',commissioned:true});
const initial=()=>({scope,missionId:'mission-a',state:'requested',version:0,seen:{}});
const event=(m,kind,id=`event-${m.version}`)=>({scope,missionId:m.missionId,id,expectedVersion:m.version,kind});
test('contract model has no dispatch authority even when every precondition passes',()=>{
 const result=evaluateContract(input()); assert.equal(result.testEligible,true);assert.equal(result.dispatchEnabled,false);
 for(const s of labScenarios) assert.equal(runContractScenario(s.id).dispatchEnabled,false);
});
test('organization, site and device are checked independently',()=>{
 for(const field of ['tenantId','siteId','deviceId']) {const i=input();i.command[field]='other';assert.equal(evaluateContract(i).reason,'scope_mismatch');}
});
test('not commissioned, unknown safety and disconnected devices fail closed',()=>{
 for(const [patch,reason] of [[{commissioned:false},'not_commissioned'],[{safety:'unknown'},'safety_unavailable'],[{safety:'blocked'},'safety_unavailable'],[{heartbeatAt:94000},'heartbeat_stale'],[{heartbeatAt:100001},'heartbeat_stale']]) assert.equal(evaluateContract({...input(),...patch}).reason,reason);
});
test('command expiry and future timestamps are not treated as valid',()=>{
 const i=input();i.command.expiresAt=i.now;assert.equal(evaluateContract(i).reason,'expired_command');
 i.command.expiresAt=110000;i.command.issuedAt=100001;assert.equal(evaluateContract(i).reason,'future_command');
});
test('lease expiry and old fencing token cannot control a resource',()=>{
 const i=input();i.lease.expiresAt=i.now;assert.equal(evaluateContract(i).reason,'lease_invalid');
 i.lease.expiresAt=120000;i.command.fence=3;assert.equal(evaluateContract(i).reason,'lease_invalid');
});
test('unknown previous result is never blindly retried; changed payload conflicts',()=>{
 const i=input();i.previous={digest:i.command.digest,state:'unknown'};assert.equal(evaluateContract(i).reason,'duplicate_command');
 i.previous.digest='changed';assert.equal(evaluateContract(i).reason,'idempotency_conflict');
});
test('nonfinite, fractional, empty and oversized validity inputs rejected',()=>{
 for(const field of ['now','heartbeatAt']) for(const bad of [NaN,Infinity,'100000',null]) assert.equal(evaluateContract({...input(),[field]:bad}).reason,'invalid_contract');
 for(const patch of [{fence:1.5},{fence:0},{id:''},{expiresAt:200000},{digest:' '}]){const i=input();Object.assign(i.command,patch);assert.equal(evaluateContract(i).reason,'invalid_contract');}
 assert.equal(evaluateContract(null).reason,'invalid_contract');
});
test('happy-path event sequence advances exactly one version per durable event',()=>{
 let m=initial();const original=m;
 for(const kind of ['validate','reserve','dispatch','ack','start','complete']) m=advanceMission(m,event(m,kind));
 assert.equal(m.state,'completed');assert.equal(m.version,6);assert.equal(original.state,'requested');assert.deepEqual(original.seen,{});
});
test('scope mismatch and concurrent versions cannot change the mission',()=>{
 const m=initial();assert.throws(()=>advanceMission(m,{...event(m,'validate'),scope:{...scope,siteId:'site-b'}}),/scope_mismatch/);
 assert.throws(()=>advanceMission(m,{...event(m,'validate'),missionId:'other'}),/scope_mismatch/);
 assert.throws(()=>advanceMission(m,{...event(m,'validate'),expectedVersion:1}),/version_conflict/);
});
test('redelivered event is a no-op and reused ID with changed contents conflicts',()=>{
 const m=initial(),e=event(m,'validate');const next=advanceMission(m,e);
 assert.equal(advanceMission(next,e),next);assert.throws(()=>advanceMission(next,{...e,kind:'cancel'}),/event_id_conflict/);
});
test('ACK loss becomes unknown; neither cancel nor redispatch can bypass reconciliation',()=>{
 let m=initial();for(const k of ['validate','reserve','dispatch','timeout']) m=advanceMission(m,event(m,k));
 assert.equal(m.state,'unknown');for(const k of ['dispatch','cancel','complete','ack']) assert.throws(()=>advanceMission(m,event(m,k)),/invalid_transition/);
 const done=advanceMission(m,event(m,'reconcile_complete'));assert.equal(done.state,'completed');
 assert.equal(advanceMission(m,event(m,'reconcile_failed')).state,'failed');
});
test('terminal states cannot restart, and events cannot skip the device ACK',()=>{
 for(const state of ['completed','cancelled','failed']) for(const kind of ['validate','dispatch','start']) assert.throws(()=>advanceMission({...initial(),state},event(initial(),kind)),/invalid_transition/);
 assert.throws(()=>advanceMission({...initial(),state:'dispatched'},event(initial(),'complete')),/invalid_transition/);
});
test('prototype keys and malformed event identity cannot create transitions',()=>{
 for(const kind of ['__proto__','constructor','toString']) assert.throws(()=>advanceMission(initial(),event(initial(),kind)),/invalid_transition/);
 assert.throws(()=>advanceMission({...initial(),state:'constructor'},event(initial(),'validate')),/invalid_transition/);
 assert.throws(()=>advanceMission(initial(),{...event(initial(),'validate'),id:''}),/invalid_event/);
 assert.throws(()=>runContractScenario('not-a-scenario'),/unknown_scenario/);
});

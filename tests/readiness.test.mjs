import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReadinessSnapshot } from '../src/lib/readiness-snapshot.ts';
import { requirements, phases, operationalAcceptance } from '../src/lib/implementation-plan.ts';
const valid=()=>({schema_version:1,observed_at:'2026-10-19T00:00:00Z',counts:{sites:0,blueprints:0,memberships:0,requests:0,devices:0,commands:0,telemetry:0,domain_events:0,ai_models:0,ai_actions:0,hil_records:0},security:{public_tables_without_rls:0,legacy_browser_grants:0}});
test('confirmed zero records accepted; missing information cannot become a zero',()=>{
 assert.equal(parseReadinessSnapshot(valid()).counts.devices,0);
 for(const bad of [null,{}, {...valid(),schema_version:2},{...valid(),observed_at:'bad'},{...valid(),counts:{}},{...valid(),security:null}]) assert.throws(()=>parseReadinessSnapshot(bad),/invalid_snapshot/);
});
test('negative, nonfinite and string counts fail validation',()=>{
 for(const count of [-1,NaN,Infinity,'0',1.2,null]){const v=valid();v.counts.devices=count;assert.throws(()=>parseReadinessSnapshot(v),/invalid_snapshot/);}
});
test('scope has a fixed denominator and code tests cannot imply field acceptance',()=>{
 assert.equal(requirements.length,36);assert.equal(new Set(requirements.map(r=>r.id)).size,36);
 assert.equal(operationalAcceptance.total,36);assert.equal(operationalAcceptance.approved,0);
 for(const r of requirements){assert.ok(phases.some(p=>p.id===r.phase));assert.ok(r.acceptance.length>15);assert.ok(r.next.length>5);for(const d of r.dependsOn)assert.ok(requirements.some(q=>q.id===d));}
});
test('requirement graph contains no self-dependency or cycle',()=>{
 const done=new Set(),active=new Set();function visit(id){if(active.has(id))throw new Error('cycle');if(done.has(id))return;active.add(id);for(const d of requirements.find(r=>r.id===id).dependsOn)visit(d);active.delete(id);done.add(id);}
 for(const r of requirements)visit(r.id);assert.equal(done.size,36);
});

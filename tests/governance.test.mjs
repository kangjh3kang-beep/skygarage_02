import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGovernanceDirectory, parseGovernanceSnapshot, safeEvidenceUrl, governanceError } from '../src/lib/governance.ts';
import { requirements } from '../src/lib/implementation-plan.ts';
const id='11111111-2222-4333-8444-555555555555';
const directory=()=>({schema_version:1,observed_at:'2026-10-19T00:00:00Z',headquarters:true,operators:[],assignments:[],organizations:[{id,name:'검증 조직'}],sites:[{id,name:'검증 현장',phase:'sandbox',organization_id:id,validation_scope_id:null}]});
const snapshot=()=>({schema_version:1,observed_at:'2026-10-19T00:00:00Z',scope:{id,site_id:id,plan_version:'2026.10-v1',release_sha:'a'.repeat(40),configuration_digest:'b'.repeat(64)},permissions:{write:true,review:false},readiness:{approved:0,covered:0,total:36,blocking_defects:0,configuration_current:true,requirements:requirements.map(r=>({id:r.id,phase:r.phase,title:r.title,required_kinds:['integration','acceptance'],dependencies:r.dependsOn,accepted:false,evidence_complete:false}))},evidence_total:0,evidence:[],improvements_total:0,improvements:[],provisioning:[],modules:[]});
test('directory validates tenant binding and cannot fabricate missing scope',()=>{
 assert.equal(parseGovernanceDirectory(directory()).sites.length,1);
 for(const bad of [null,{}, {...directory(),sites:[{...directory().sites[0],organization_id:'other'}]}, {...directory(),headquarters:'true'},{...directory(),operators:null}])assert.throws(()=>parseGovernanceDirectory(bad));
});
test('valid zero acceptance must come from a complete versioned response',()=>{
 assert.equal(parseGovernanceSnapshot(snapshot()).readiness.approved,0);
 for(const patch of [{schema_version:2},{readiness:{}},{evidence:null},{observed_at:'invalid'},{permissions:{write:'true',review:true}}])assert.throws(()=>parseGovernanceSnapshot({...snapshot(),...patch}));
});
test('missing or repeated requirements cannot raise the completion percentage',()=>{
 for(const change of [s=>s.readiness.total=35,s=>s.readiness.requirements.pop(),s=>s.readiness.requirements[1]=s.readiness.requirements[0],s=>s.readiness.approved=36]){const s=snapshot();change(s);assert.throws(()=>parseGovernanceSnapshot(s));}
});
test('acceptance requires coverage and dependencies, not a counter alone',()=>{
 const s=snapshot();s.readiness.approved=1;s.readiness.covered=1;s.readiness.requirements[1].accepted=true;s.readiness.requirements[1].evidence_complete=true;
 assert.throws(()=>parseGovernanceSnapshot(s));
 const good=snapshot();good.readiness.approved=1;good.readiness.covered=1;good.readiness.requirements[0].accepted=true;good.readiness.requirements[0].evidence_complete=true;
 assert.equal(parseGovernanceSnapshot(good).readiness.approved,1);
 good.readiness.configuration_current=false;assert.throws(()=>parseGovernanceSnapshot(good));
});
test('sensitive signed URLs and active content cannot become evidence links',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,hello','https://user:pass@example.org/a','https://example.org/a?token=secret','https://example.org/a#secret','http://example.org/a'])assert.equal(safeEvidenceUrl(value),null);
 assert.equal(safeEvidenceUrl('https://example.org/reports/test.pdf'),'https://example.org/reports/test.pdf');
});
test('untrusted error text is not shown to operators',()=>{
 assert.equal(governanceError({message:'postgres debug secret=123'}).includes('secret'),false);
 assert.match(governanceError({message:'independent_reviewer_required'}),/다른 검수자/);
});
test('catalog preserves all 36 IDs, dependencies and acceptance criteria',()=>{
 const sql=readFileSync(new URL('../supabase/sql/platform-governance-catalog.sql',import.meta.url),'utf8');
 for(const r of requirements){assert.ok(sql.includes(`'${r.id}','${r.phase}'`));assert.ok(sql.includes(r.acceptance));}
 assert.equal(sql.match(/\('2026\.10-v1'/g).length,36);
});
test('review package migration exactly matches reviewed SQL sources',()=>{
 const parts=['platform-governance.sql','platform-governance-catalog.sql','platform-governance-scheduler.sql'].map(n=>readFileSync(new URL('../supabase/sql/'+n,import.meta.url),'utf8'));
 const migration=readFileSync(new URL('../supabase/migrations/20261018230357_add_platform_feedback_governance.sql',import.meta.url),'utf8');
 assert.equal(migration,parts.join('\n'));
});

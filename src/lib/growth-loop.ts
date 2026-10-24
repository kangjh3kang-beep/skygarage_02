import { parseGovernanceSnapshot, testKinds, type GovernanceSnapshot, type Evidence } from './governance.ts';

export const loopCountLabels = {active:'진행 중 과제',critical:'치명 과제',unassigned:'담당 미지정',verification:'완료 검수 대기',closed:'완료한 과제',pending_reviews:'증거 검수 대기',expired:'만료 증거',expiring:'7일 내 만료 근거'} as const;
export type GrowthLoopSnapshot = GovernanceSnapshot & {
 counts:Record<keyof typeof loopCountLabels,number>;
 blockers:{id:string;missing_kinds:(keyof typeof testKinds)[];open_defects:number}[];
 next_improvement:string|null;next_evidence:string|null;
};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
function requireValid(value:unknown):asserts value {if(!value)throw new Error('invalid_growth_loop_response');}
export function parseGrowthLoopSnapshot(value:unknown):GrowthLoopSnapshot {
 const data=parseGovernanceSnapshot(value) as GrowthLoopSnapshot;
 requireValid(data.counts&&Object.keys(loopCountLabels).every(k=>count(data.counts[k as keyof typeof loopCountLabels])));
 requireValid(data.counts.critical<=data.counts.active&&data.counts.unassigned<=data.counts.active&&data.counts.verification<=data.counts.active);
 requireValid(Array.isArray(data.blockers)&&data.blockers.length===36&&new Set(data.blockers.map(b=>b.id)).size===36);
 for(const b of data.blockers){requireValid(data.readiness.requirements.some(r=>r.id===b.id)&&count(b.open_defects)&&Array.isArray(b.missing_kinds));requireValid(new Set(b.missing_kinds).size===b.missing_kinds.length&&b.missing_kinds.every(k=>Object.hasOwn(testKinds,k)));}
 for(const [rows,next] of [[data.improvements,data.next_improvement],[data.evidence,data.next_evidence]] as const){
  requireValid(rows.length<=25&&new Set(rows.map(r=>r.id)).size===rows.length&&(next===null||uuid(next)));
  requireValid(next===null||(rows.length===25&&rows.at(-1)?.id===next));
 }
 requireValid(data.blockers.reduce((sum,b)=>sum+b.open_defects,0)===data.readiness.blocking_defects);
 for(const r of data.readiness.requirements)if(r.accepted){const b=data.blockers.find(b=>b.id===r.id)!;requireValid(!b.open_defects&&!b.missing_kinds.length);}
 return data;
}
export type RetestCandidates={schema_version:1;item_id:string;scope_id:string;evidence:Evidence[];next:string|null};
export function parseRetestCandidates(value:unknown):RetestCandidates {
 requireValid(value&&typeof value==='object');const v=value as RetestCandidates;
 requireValid(v.schema_version===1&&uuid(v.item_id)&&uuid(v.scope_id)&&Array.isArray(v.evidence)&&v.evidence.length<=25);
 for(const e of v.evidence)requireValid(uuid(e.id)&&e.result==='pass'&&typeof e.summary==='string'&&Object.hasOwn(testKinds,e.test_kind)&&Number.isFinite(Date.parse(e.measured_at)));
 requireValid(new Set(v.evidence.map(e=>e.id)).size===v.evidence.length&&(v.next===null||(v.evidence.length===25&&uuid(v.next)&&v.evidence.at(-1)?.id===v.next)));
 return v;
}

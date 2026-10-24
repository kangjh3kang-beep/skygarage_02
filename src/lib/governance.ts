import { PLAN_VERSION, requirements } from './implementation-plan.ts';

export const testKinds = { software:'소프트웨어', integration:'DB·API 통합', contract:'제조사 계약', sil:'SIL 모의시험', hil:'HIL 실장비', sat:'현장 인수', operations:'운영·복구', acceptance:'전체 완료조건 검수' } as const;
export const environments = {simulation:'시뮬레이션',staging:'검증 환경',hardware:'실장비',field:'실제 현장'} as const;
export const improvementStates = {open:'접수',in_progress:'개선 중',verification:'재검증·검수 대기',closed:'완료'} as const;
export const sitePhases = {draft:'초안',contracting:'협의 중',sandbox:'검증용',site_acceptance:'현장 인수 중',ready:'인수 승인',suspended:'중지'} as const;
export type EvidenceKind = keyof typeof testKinds;
export type EvidenceEnvironment = keyof typeof environments;
export type Directory = {schema_version:1;observed_at:string;headquarters:boolean;operators:{id:string;name:string}[];assignments:{site_id:string;user_id:string;role:string;active:boolean;valid_until:string;revision:number}[];organizations:{id:string;name:string}[];sites:{id:string;name:string;phase:keyof typeof sitePhases;organization_id:string;validation_scope_id:string|null}[]};
export type Evidence = {id:string;requirement_id:string;test_kind:EvidenceKind;environment:EvidenceEnvironment;result:'pass'|'fail';summary:string;submitted_by:string;artifact_uri:string;artifact_sha256:string;procedure_version:string;measured_at:string;expires_at:string;created_at:string;review:{decision:'approved'|'rejected';note:string;reviewer_id:string}|null};
export type Improvement = {id:string;requirement_id:string;kind:'defect'|'improvement';severity:'critical'|'high'|'normal';title:string;description:string;status:keyof typeof improvementStates;revision:number;created_by:string;assigned_to:string|null;created_at:string;resolution_evidence_id:string|null};
export type GovernanceSnapshot = {schema_version:1;observed_at:string;scope:{id:string;site_id:string;plan_version:string;release_sha:string;configuration_digest:string};permissions:{write:boolean;review:boolean};readiness:{approved:number;covered:number;total:number;blocking_defects:number;configuration_current:boolean;requirements:{id:string;phase:string;title:string;required_kinds:EvidenceKind[];accepted:boolean;evidence_complete:boolean;dependencies:string[]}[]};evidence_total:number;evidence:Evidence[];improvements_total:number;improvements:Improvement[];provisioning:{id:string;status:'pending'|'processed'|'dead_letter';attempts:number;last_error:string|null}[];modules:{module:string;state:string}[]};

type Obj = Record<string,unknown>;
const object = (v:unknown):Obj => {if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('invalid_governance_response');return v as Obj;};
const check = (v:unknown):void => {if(!v)throw new Error('invalid_governance_response');};
const array = (v:unknown):unknown[] => {check(Array.isArray(v));return v as unknown[];};
const string = (v:unknown) => typeof v==='string'&&v.length>0;
const count = (v:unknown) => typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const date = (v:unknown) => typeof v==='string'&&Number.isFinite(Date.parse(v));
const uuid = (v:unknown) => typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const knownRequirement = (v:unknown) => requirements.some(r=>r.id===v);
export function safeEvidenceUrl(value:string):string|null {
 try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash?u.href:null;}catch{return null;}
}
export function parseGovernanceDirectory(value:unknown):Directory {
 const v=object(value);check(v.schema_version===1&&date(v.observed_at)&&typeof v.headquarters==='boolean');
 for(const raw of array(v.operators)){const o=object(raw);check(uuid(o.id)&&string(o.name));}
 for(const raw of array(v.assignments)){const a=object(raw);check(uuid(a.site_id)&&uuid(a.user_id)&&['manager','reviewer','viewer'].includes(String(a.role))&&typeof a.active==='boolean'&&date(a.valid_until)&&count(a.revision));}
 for(const raw of array(v.organizations)){const o=object(raw);check(uuid(o.id)&&string(o.name));}
 const ids=new Set(array(v.organizations).map(o=>object(o).id));
 for(const raw of array(v.sites)){const s=object(raw);check(uuid(s.id)&&string(s.name)&&typeof s.phase==='string'&&Object.hasOwn(sitePhases,s.phase)&&ids.has(s.organization_id)&&(s.validation_scope_id===null||uuid(s.validation_scope_id)));}
 return value as Directory;
}
export function parseGovernanceSnapshot(value:unknown):GovernanceSnapshot {
 const v=object(value),s=object(v.scope),p=object(v.permissions),r=object(v.readiness);
 check(v.schema_version===1&&date(v.observed_at)&&uuid(s.id)&&uuid(s.site_id)&&s.plan_version===PLAN_VERSION);
 check(typeof s.release_sha==='string'&&/^[a-f0-9]{40}$/.test(s.release_sha)&&typeof s.configuration_digest==='string'&&/^[a-f0-9]{64}$/.test(s.configuration_digest));
 check(typeof p.write==='boolean'&&typeof p.review==='boolean'&&typeof r.configuration_current==='boolean');
 check(count(r.approved)&&count(r.covered)&&r.total===36&&count(r.blocking_defects));
 const rows=array(r.requirements).map(object);check(rows.length===36&&new Set(rows.map(x=>x.id)).size===36);
 for(const row of rows){check(knownRequirement(row.id)&&typeof row.accepted==='boolean'&&typeof row.evidence_complete==='boolean');check(array(row.required_kinds).includes('acceptance'));for(const k of array(row.required_kinds))check(typeof k==='string'&&Object.hasOwn(testKinds,k));for(const d of array(row.dependencies))check(knownRequirement(d));}
 const accepted=new Set(rows.filter(x=>x.accepted).map(x=>x.id));
 check(accepted.size===r.approved&&rows.filter(x=>x.evidence_complete).length===r.covered);
 for(const row of rows)if(row.accepted)check(row.evidence_complete&&array(row.dependencies).every(d=>accepted.has(d)));
 check(r.configuration_current||r.approved===0);
 check(count(v.evidence_total)&&count(v.improvements_total));
 const es=array(v.evidence);check(es.length<=Number(v.evidence_total));
 for(const raw of es){const e=object(raw);check(uuid(e.id)&&knownRequirement(e.requirement_id)&&typeof e.test_kind==='string'&&Object.hasOwn(testKinds,e.test_kind)&&typeof e.environment==='string'&&Object.hasOwn(environments,e.environment));check(['pass','fail'].includes(String(e.result))&&uuid(e.submitted_by)&&string(e.summary)&&date(e.measured_at)&&date(e.expires_at)&&date(e.created_at));check(typeof e.artifact_sha256==='string'&&/^[0-9a-f]{64}$/.test(e.artifact_sha256)&&string(e.procedure_version));check(typeof e.artifact_uri==='string'&&safeEvidenceUrl(e.artifact_uri));if(e.review!==null){const review=object(e.review);check(['approved','rejected'].includes(String(review.decision))&&uuid(review.reviewer_id)&&review.reviewer_id!==e.submitted_by&&string(review.note));}}
 const items=array(v.improvements);check(items.length<=Number(v.improvements_total));
 for(const raw of items){const i=object(raw);check(uuid(i.id)&&knownRequirement(i.requirement_id)&&typeof i.status==='string'&&Object.hasOwn(improvementStates,i.status)&&count(i.revision)&&Number(i.revision)>0&&string(i.title)&&string(i.description)&&uuid(i.created_by)&&date(i.created_at)&&['defect','improvement'].includes(String(i.kind))&&['critical','high','normal'].includes(String(i.severity))&&(i.assigned_to===null||uuid(i.assigned_to))&&(i.resolution_evidence_id===null||uuid(i.resolution_evidence_id)));}
 for(const raw of array(v.provisioning)){const q=object(raw);check(uuid(q.id)&&['pending','processed','dead_letter'].includes(String(q.status))&&count(q.attempts));}
 for(const raw of array(v.modules)){const m=object(raw);check(['resident_profile','service_requests'].includes(String(m.module))&&m.state==='configured');}
 return value as GovernanceSnapshot;
}
const errors:Record<string,string>={
 invalid_loop_filter:'조회 조건을 확인해 주세요.',invalid_loop_cursor:'조회 위치가 유효하지 않습니다. 루프를 새로 조회해 주세요.',
 reauthentication_required:'로그인 세션을 확인할 수 없습니다. 다시 로그인한 뒤 새로 조회하세요.',headquarters_required:'본사 공통 요청은 최고관리자만 조회·처리할 수 있습니다.',request_scope_conflict:'요청의 현장 연결이 바뀌었습니다. 요청함을 새로 조회하세요.',
 mfa_required:'관리자 2단계 인증을 완료해 주세요.',super_admin_mfa_required:'최고관리자의 2단계 인증이 필요합니다.',site_access_denied:'이 현장의 권한이 없거나 회수되었습니다.',site_unavailable:'소속 조직이 확인된 현장을 선택해 주세요.',
 independent_reviewer_required:'제출자·개선 담당자와 다른 검수자가 확인해야 합니다.',version_conflict:'다른 작업으로 상태가 바뀌었습니다. 새로 조회해 주세요.',idempotency_conflict:'같은 요청 번호에 다른 내용이 있습니다. 내용을 확인해 주세요.',
 new_passing_evidence_required:'과제 등록 이후 생성한 같은 요구사항의 통과 증거가 필요합니다.',matching_retest_required:'실패 시험과 같은 종류·환경으로 더 나중에 수행한 재시험이 필요합니다.',reviewed_retest_required:'재시험 증거의 독립 검수를 먼저 완료해 주세요.',
 passing_current_evidence_required:'유효기간 내의 통과 증거만 승인할 수 있습니다.',review_immutable:'완료된 검수는 수정할 수 없습니다. 새 증거로 다시 제출해 주세요.',configuration_changed:'현장 설정이 달라졌습니다. 새 검증 범위를 생성해 주세요.',
 foundation_gates_missing:'기본 권한·현장 격리·증거 관리의 인수 근거가 부족합니다.',acceptance_gates_missing:'36개 요구사항 전체의 유효한 인수 증거가 필요합니다.',open_defects:'미해결 결함을 재검증하고 독립 검수해 주세요.',provisioning_incomplete:'자동 구축 대기열 처리가 완료되어야 합니다.',
 invalid_evidence_time:'측정 시각·유효기간을 확인해 주세요.',rate_limited:'짧은 시간의 등록 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',invalid_transition:'현재 상태에서 선택한 단계로 이동할 수 없습니다.',
};
export function governanceError(error:unknown):string {const msg=error&&typeof error==='object'&&'message' in error?String(error.message):'';return Object.entries(errors).find(([key])=>msg.includes(key))?.[1]||'처리 결과를 확인하지 못했습니다. 입력값·권한·연결을 확인하고 다시 조회해 주세요. 재시도 시 같은 요청 번호를 사용합니다.';}

import { membershipError } from './membership';
export type RequestCategory='residence'|'vehicle'|'visit'|'concierge';
export type RequestStatus='submitted'|'reviewing'|'resolved'|'rejected';
export type ServiceRequest={id:string;site_id:string|null;site_name:string|null;category:RequestCategory;subject:string;description:string;status:RequestStatus;response:string|null;created_at:string;due_at:string|null;reviewed_at:string|null;overdue:boolean};
export type RequestRow={id:string;site_id:string|null;category:RequestCategory;subject:string;status:RequestStatus;revision:number;assigned_to:string|null;assignee_name:string;due_at:string|null;created_at:string;requester:string;overdue:boolean};
export type RequestSnapshot={schema_version:1;site_id:string|null;headquarters:boolean;can_manage:boolean;rows:RequestRow[];counts:{open:number;unassigned:number;overdue:number};assignees:{id:string;name:string}[];next_cursor:string|null;observed_at:string};
export type RequestDetail={schema_version:1;request:{id:string;site_id:string|null;revision:number;subject:string;description:string;status:RequestStatus;response:string|null;assigned_to:string|null;due_at:string|null};history:{id:string;actor_id:string;action:string;reason:string;details:{revision:number;response:string|null};created_at:string}[];observed_at:string};
const obj=(x:unknown):Record<string,unknown>=>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error('invalid_service_request_response');return x as Record<string,unknown>;};
const id=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const date=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const nullableId=(x:unknown)=>x===null||id(x),nullableDate=(x:unknown)=>x===null||date(x);
const count=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0;
const check=(x:unknown)=>{if(!x)throw Error('invalid_service_request_response');};
const statuses=['submitted','reviewing','resolved','rejected'];
export function parseRequestSnapshot(input:unknown):RequestSnapshot{
 const v=obj(input),c=obj(v.counts);check(v.schema_version===1&&nullableId(v.site_id)&&typeof v.headquarters==='boolean'&&typeof v.can_manage==='boolean'&&Array.isArray(v.rows)&&v.rows.length<=50&&Array.isArray(v.assignees)&&nullableId(v.next_cursor)&&date(v.observed_at)&&['open','unassigned','overdue'].every(k=>count(c[k])));
 for(const raw of v.rows as unknown[]){const r=obj(raw);check(id(r.id)&&r.site_id===v.site_id&&statuses.includes(String(r.status))&&count(r.revision)&&Number(r.revision)>0&&nullableId(r.assigned_to)&&nullableDate(r.due_at)&&date(r.created_at)&&typeof r.subject==='string'&&typeof r.requester==='string'&&typeof r.assignee_name==='string'&&typeof r.overdue==='boolean');}
 for(const raw of v.assignees as unknown[]){const a=obj(raw);check(id(a.id)&&typeof a.name==='string');}return v as unknown as RequestSnapshot;
}
export function parseRequestDetail(input:unknown):RequestDetail{
 const v=obj(input),r=obj(v.request);check(v.schema_version===1&&id(r.id)&&nullableId(r.site_id)&&count(r.revision)&&Number(r.revision)>0&&statuses.includes(String(r.status))&&typeof r.subject==='string'&&typeof r.description==='string'&&(r.response===null||typeof r.response==='string')&&nullableId(r.assigned_to)&&nullableDate(r.due_at)&&Array.isArray(v.history)&&v.history.length<=30&&date(v.observed_at));
 for(const raw of v.history as unknown[]){const h=obj(raw),d=obj(h.details);check(typeof h.id==='string'&&/^\d+$/.test(h.id)&&id(h.actor_id)&&typeof h.action==='string'&&typeof h.reason==='string'&&date(h.created_at)&&count(d.revision)&&(d.response===undefined||d.response===null||typeof d.response==='string'));}return v as unknown as RequestDetail;
}
export function parseMyRequests(input:unknown):ServiceRequest[]{
 const v=obj(input);check(v.schema_version===1&&Array.isArray(v.rows)&&v.rows.length<=30&&date(v.observed_at));
 for(const raw of v.rows as unknown[]){const r=obj(raw);check(id(r.id)&&nullableId(r.site_id)&&(r.site_name===null||typeof r.site_name==='string')&&['residence','vehicle','visit','concierge'].includes(String(r.category))&&statuses.includes(String(r.status))&&['subject','description'].every(k=>typeof r[k]==='string')&&(r.response===null||typeof r.response==='string')&&date(r.created_at)&&nullableDate(r.due_at)&&nullableDate(r.reviewed_at)&&typeof r.overdue==='boolean');}return v.rows as ServiceRequest[];
}
export function serviceRequestError(e:unknown):string{
 const key=e&&typeof e==='object'&&'message'in e?String(e.message):'';
 const labels:Record<string,string>={headquarters_required:'본사 공통 요청은 최고관리자만 처리할 수 있습니다.',request_scope_conflict:'요청이 다른 현장으로 연결됐거나 조회 범위가 바뀌었습니다. 요청함을 다시 조회하세요.',request_site_unavailable:'선택한 현장에서 요청자의 활성 소속이 확인되지 않습니다. 소속을 확인하거나 본사 공통 문의로 접수하세요.',assignee_unavailable:'처리 권한이 유효한 해당 현장 담당자 또는 최고관리자를 선택하세요.',assignee_required:'기한을 정하려면 담당자를 먼저 선택하세요.',assigned_actor_required:'배정된 담당자가 처리해야 합니다. 필요한 경우 먼저 담당자를 재배정하세요.',invalid_due_at:'목표 기한은 현재보다 늦고 30일 이내여야 합니다.',response_required:'회원에게 표시할 답변을 2~2000자로 작성하세요.',invalid_transition:'담당자 배정 후 검토 시작을 거쳐 완료 또는 반려하세요.',request_closed:'종료된 요청은 변경할 수 없습니다. 후속 문의는 새 요청으로 접수하세요.',route_confirmation_required:'요청자가 이용하는 현장을 확인하고 연결 확인란을 선택하세요.',invalid_service_request:'제목 2~80자와 요청 내용 5~2000자를 확인하세요.'};return labels[key]??membershipError(e);
}
export const requestActionLabels:Record<string,string>={submitted:'요청 접수',route:'현장 연결',assign:'담당자·목표 기한 변경',review:'상태·답변 처리'};

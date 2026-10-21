export type MembershipKind = 'requests' | 'members' | 'invites' | 'history';
export type MembershipRow = { id: string; user_id?: string | null; actor_id?: string; display_name?: string; unit_label?: string; status?: string; revision?: number; reason?: string; phone_verified?: boolean; created_at?: string; decided_at?: string | null; expires_at?: string; max_uses?: number; uses?: number; revoked?: boolean; action?: string };
export type SiteProfile = {revision:number;address:string;office_phone:string;service_hours:string};
export type MembershipSnapshot = {schema_version:1;site:{id:string;name:string;phase:string};can_manage:boolean;profile:SiteProfile;counts:{pending:number;active:number;revoked:number};kind:MembershipKind;rows:MembershipRow[];next_cursor:string|null;observed_at:string};
export type OwnMemberships = {schema_version:1;applications:{id:string;site_id:string;site_name:string;phase:string;unit_label:string;status:string;revision:number;reason:string;created_at:string}[];memberships:{site_id:string;site_name:string;phase:string;unit_label:string;status:string}[];observed_at:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const object=(x:unknown):Record<string,unknown>=>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error('invalid_membership_response');return x as Record<string,unknown>;};
function check(ok:unknown):asserts ok{if(!ok)throw Error('invalid_membership_response');}
const date=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const id=(x:unknown)=>typeof x==='string'&&uuid.test(x);
const integer=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0;
const statusLabels:Record<string,string>={pending:'승인 대기',active:'승인된 소속',revoked:'소속 회수',approved:'승인',rejected:'반려',withdrawn:'신청 철회',sandbox:'시험용 현장',site_acceptance:'현장 인수 중',ready:'운영 준비',suspended:'운영 중지'};
export const membershipLabel=(x:string)=>statusLabels[x]??x;
export function parseMembershipSnapshot(input:unknown):MembershipSnapshot{
 const v=object(input),s=object(v.site),p=object(v.profile),c=object(v.counts);
 check(v.schema_version===1&&id(s.id)&&typeof s.name==='string'&&typeof s.phase==='string'&&typeof v.can_manage==='boolean'&&integer(p.revision)&&['address','office_phone','service_hours'].every(k=>typeof p[k]==='string')&&['pending','active','revoked'].every(k=>integer(c[k]))&&['requests','members','invites','history'].includes(String(v.kind))&&Array.isArray(v.rows)&&v.rows.length<=50&&date(v.observed_at)&&(v.next_cursor===null||id(v.next_cursor)));
 for(const item of v.rows){const r=object(item);check(id(r.id)&&!('code'in r)&&!('token_hash'in r));
  if(v.kind==='requests'||v.kind==='members')check(id(r.user_id)&&typeof r.display_name==='string'&&typeof r.unit_label==='string'&&typeof r.phone_verified==='boolean'&&integer(r.revision)&&Number(r.revision)>0&&['pending','active','revoked','approved','rejected','withdrawn'].includes(String(r.status)));
  if(v.kind==='requests')check(date(r.created_at)&&typeof r.reason==='string');
  if(v.kind==='invites')check(date(r.expires_at)&&date(r.created_at)&&integer(r.max_uses)&&integer(r.uses)&&integer(r.revision)&&typeof r.revoked==='boolean');
  if(v.kind==='history')check(typeof r.action==='string'&&typeof r.reason==='string'&&date(r.created_at)&&id(r.actor_id));
 }
 return v as unknown as MembershipSnapshot;
}
export function parseOwnMemberships(input:unknown):OwnMemberships{
 const v=object(input);check(v.schema_version===1&&Array.isArray(v.applications)&&Array.isArray(v.memberships)&&date(v.observed_at));
 for(const item of v.applications){const r=object(item);check(id(r.id)&&id(r.site_id)&&typeof r.site_name==='string'&&typeof r.phase==='string'&&typeof r.unit_label==='string'&&['pending','approved','rejected','withdrawn'].includes(String(r.status))&&integer(r.revision)&&typeof r.reason==='string'&&date(r.created_at));}
 for(const item of v.memberships){const r=object(item);check(id(r.site_id)&&typeof r.site_name==='string'&&typeof r.phase==='string'&&typeof r.unit_label==='string'&&['pending','active','revoked'].includes(String(r.status)));}
 return v as unknown as OwnMemberships;
}
export function membershipError(error:unknown):string{
 const message=error&&typeof error==='object'&&'message'in error?String(error.message):'';
 const labels:Record<string,string>={phone_verification_required:'문자 인증이 완료된 활성 회원만 신청·승인할 수 있습니다.',invite_unavailable:'초대코드가 만료·폐기됐거나 사용 한도에 도달했습니다. 현장 담당자에게 새 코드를 요청하세요.',application_pending:'이 현장에 승인 대기 중인 신청이 있습니다. 내 신청 내역을 확인하세요.',already_member:'이미 승인된 소속입니다. 내 소속을 다시 조회하세요.',version_conflict:'다른 변경이 먼저 반영됐습니다. 새로 조회하고 최신 상태에서 다시 처리하세요.',idempotency_conflict:'재시도 요청의 내용이 달라졌습니다. 현재 상태를 조회한 뒤 다시 처리하세요.',site_access_denied:'이 현장을 관리할 권한이 없습니다. 담당 현장과 권한을 확인하세요.',mfa_required:'관리자 2단계 인증을 완료한 뒤 다시 시도하세요.',application_closed:'이미 처리된 신청입니다. 최신 상태를 조회하세요.',independent_approver_required:'본인의 소속 신청은 다른 현장 관리자에게 승인받아야 합니다.',site_not_open:'현재 단계에서는 회원 신청·초대·승인을 제공하지 않습니다.',reason_required:'처리 사유를 5자 이상 입력하세요.',active_member_required:'승인된 회원만 소속을 회수할 수 있습니다.',rate_limited:'요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.',application_unavailable:'본인 또는 담당 현장의 신청인지 확인하세요.'};
 return labels[message]??'처리 결과를 확인하지 못했습니다. 먼저 최신 상태를 조회하세요. 같은 내용의 재시도는 동일 요청으로 처리됩니다.';
}

export type ResidencePolicy={mode:'free_text'|'registered_unit';revision:number};
export type ResidenceRow={id:string;label:string;active:boolean;revision:number;building_id?:string;active_members?:number};
export type ResidenceDirectory={schema_version:1;site_id:string;building_id:string|null;can_manage:boolean;policy:ResidencePolicy;unmapped_active_members:number;rows:ResidenceRow[];next_cursor:string|null;observed_at:string};
const id=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x);
const integer=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0;
export function parseResidenceDirectory(input:unknown):ResidenceDirectory{
 const v=input as ResidenceDirectory;
 if(!v||v.schema_version!==1||!id(v.site_id)||(v.building_id!==null&&!id(v.building_id))||typeof v.can_manage!=='boolean'||!v.policy||!['free_text','registered_unit'].includes(v.policy.mode)||!integer(v.policy.revision)||!integer(v.unmapped_active_members)||!Array.isArray(v.rows)||v.rows.length>50||(v.next_cursor!==null&&!id(v.next_cursor))||!Number.isFinite(Date.parse(v.observed_at)))throw Error('invalid_residence_response');
 for(const r of v.rows)if(!r||!id(r.id)||typeof r.label!=='string'||r.label.length>30||typeof r.active!=='boolean'||!integer(r.revision)||r.revision<1||(v.building_id!==null&&(r.building_id!==v.building_id||!integer(r.active_members))))throw Error('invalid_residence_response');
 return v;
}

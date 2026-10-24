import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { membershipDatabase } from './membership-database.mjs';
export async function serviceRequestDatabase(){
 const db=await membershipDatabase();
 await db.pg.exec(await readFile(new URL('../../supabase/sql/service-request-operations.sql',import.meta.url),'utf8'));
 for(const who of ['hq','manager','otherManager','viewer'])await db.pg.query('update public.user_roles set display_name=$1 where user_id=$2',[`SYNTHETIC ${who}`,db.ids[who]]);
 const submit=(actor,site=null,key=randomUUID(),subject='SYNTHETIC request',description='SYNTHETIC request details')=>db.call(actor,'sgp_submit_service_request',{p_client_request_id:key,p_category:'concierge',p_subject:subject,p_description:description,p_site_id:site},'aal1');
 const act=(actor,action,payload,key=randomUUID(),aal='aal2')=>db.call(actor,'platform_service_request_command',{p_request_id:key,p_action:action,p_payload:payload},aal);
 const snapshot=(actor,site=null,status='open',after=null)=>db.call(actor,'platform_service_request_snapshot',{p_site_id:site,p_status:status,p_after:after});
 const own=actor=>db.call(actor,'platform_my_service_requests',{},'aal1');
 return {...db,submit,act,snapshot,own};
}

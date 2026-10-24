import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { membershipDatabase } from './membership-database.mjs';
import { parseGrowthLoopSnapshot } from '../../src/lib/growth-loop.ts';

export async function growthDatabase(){
 const db=await membershipDatabase();
 await db.pg.exec(await readFile(new URL('../../supabase/sql/governance-loop-hardening.sql',import.meta.url),'utf8'));
 const scope=await db.call(db.ids.manager,'platform_open_validation_scope',{p_request_id:randomUUID(),p_site_id:db.ids.siteA,p_release_sha:'a'.repeat(40)});
 await db.call(db.ids.hq,'platform_set_site_staff',{p_site_id:db.ids.siteA,p_user_id:db.ids.otherManager,p_role:'reviewer',p_active:true,p_valid_until:new Date(Date.now()+86400000).toISOString(),p_expected_revision:0});
 const create=(title='Synthetic improvement',kind='improvement')=>db.call(db.ids.manager,'platform_create_improvement',{p_scope_id:scope,p_request_id:randomUUID(),p_requirement_id:'F01',p_kind:kind,p_severity:'high',p_title:title,p_description:'Synthetic observation and verification plan'});
 const proof=(actor=db.ids.manager,kind='integration',result='pass',measured=new Date().toISOString())=>db.call(actor,'platform_submit_evidence',{p_scope_id:scope,p_request_id:randomUUID(),p_requirement_id:'F01',p_test_kind:kind,p_environment:'staging',p_result:result,p_procedure_version:'synthetic-loop/v1',p_artifact_uri:'https://example.invalid/fixture.json',p_artifact_sha256:'c'.repeat(64),p_summary:'SYNTHETIC disposable database only',p_measured_at:measured,p_expires_at:new Date(Date.now()+86400000).toISOString()});
 const move=(actor,id,revision,status,evidence=null,key=randomUUID())=>db.call(actor,'platform_transition_improvement_v2',{p_request_id:key,p_id:id,p_expected_revision:revision,p_status:status,p_evidence_id:evidence});
 const snap=(args={},actor=db.ids.manager)=>db.call(actor,'platform_growth_loop_snapshot',{p_scope_id:scope,...args}).then(parseGrowthLoopSnapshot);
 return {...db,scope,create,proof,move,snap};
}

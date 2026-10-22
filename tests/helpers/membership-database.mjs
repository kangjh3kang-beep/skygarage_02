// Disposable fixtures only. Claims emulate SQL authorization, not hosted JWTs
// or real SMS verification. No fixture is ever loaded into the hosted project.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import EmbeddedPostgres from 'embedded-postgres';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export async function membershipDatabase() {
 let pg;
 if (process.env.MEMBERSHIP_NATIVE === '1') {
  const dir=await mkdtemp(join(tmpdir(),'doelv-members-'));
  const db=new EmbeddedPostgres({databaseDir:join(dir,'data'),port:30000+Math.floor(Math.random()*1000),user:'postgres',password:randomUUID(),persistent:false,createPostgresUser:false,postgresFlags:['-c','listen_addresses=127.0.0.1','-c','unix_socket_directories='],onLog:()=>{},onError:()=>{}});
  await db.initialise();await db.start();const client=db.getPgClient('postgres','127.0.0.1');await client.connect();
  pg={exec:q=>client.query(q),query:(...args)=>client.query(...args),close:async()=>{await client.end();await db.stop();await rm(dir,{recursive:true,force:true});}};
 } else pg=await PGlite.create({extensions:{pgcrypto}});
 const root=new URL('../../',import.meta.url);
 for(const p of ['tests/governance-bootstrap.sql','supabase/sql/platform-foundation.sql','supabase/sql/site-template-generator.sql','supabase/sql/platform-governance.sql','supabase/sql/platform-governance-catalog.sql'])await pg.exec(await readFile(new URL(p,root),'utf8'));
 await pg.exec('alter table public.sgp_users add column display_name text, add column phone_verified_at timestamptz');
 await pg.exec(await readFile(new URL('supabase/sql/site-membership-operations.sql',root),'utf8'));
 await pg.exec(await readFile(new URL('supabase/sql/site-residence-directory.sql',root),'utf8'));
 const ids=Object.fromEntries(['hq','manager','otherManager','viewer','member','otherMember','unverified'].map(k=>[k,randomUUID()]));
 for(const [name,id] of Object.entries(ids)){
  await pg.query('insert into auth.users(id) values($1)',[id]);
  await pg.query('insert into public.sgp_users(id,is_verified,display_name,phone_verified_at) values($1,$2,$3,$4)',[id,name!=='unverified',`SYNTHETIC ${name}`,name==='unverified'?null:'2026-10-01T00:00:00Z']);
 }
 for(const [who,role] of [['hq','super_admin'],['manager','operator'],['otherManager','operator'],['viewer','viewer']])await pg.query('insert into public.user_roles(user_id,role) values($1,$2)',[ids[who],role]);
 let tail=Promise.resolve();
 function as(actor,sql,args=[],aal='aal2',role='authenticated'){
  const work=tail.then(async()=>{await pg.exec(`set role ${role}`);await pg.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,role,aal,user_metadata:{role:'super_admin'}})]);try{return await pg.query(sql,args);}finally{await pg.exec('reset role');}});
  tail=work.catch(()=>{});return work;
 }
 const call=async(actor,name,args={},aal='aal2')=>{
  const names=Object.keys(args);const q=`select public.${name}(${names.map((k,i)=>`${k}=>$${i+1}`).join(',')}) result`;
  return (await as(actor,q,names.map(k=>typeof args[k]==='object'&&args[k]!==null?JSON.stringify(args[k]):args[k]),aal)).rows[0].result;
 };
 const command=(actor,action,payload,request=randomUUID(),aal='aal2')=>call(actor,'platform_membership_command',{p_request_id:request,p_action:action,p_payload:payload},aal);
 const org=await call(ids.hq,'platform_create_organization',{p_request_id:randomUUID(),p_name:'Synthetic membership organization'});
 for(const [key,name] of [['siteA','SYNTHETIC site A'],['siteB','SYNTHETIC site B']])ids[key]=await call(ids.hq,'platform_generate_site_v2',{p_request_id:randomUUID(),p_organization_id:org,p_name:name,p_kind:'apartment',p_households:10,p_parking_spaces:20});
 for(const [who,site,role] of [['manager',ids.siteA,'manager'],['viewer',ids.siteA,'viewer'],['otherManager',ids.siteB,'manager']])await call(ids.hq,'platform_set_site_staff',{p_site_id:site,p_user_id:ids[who],p_role:role,p_active:true,p_valid_until:new Date(Date.now()+86400000).toISOString(),p_expected_revision:0});
 return {pg,ids,as,call,command,close:()=>pg.close()};
}

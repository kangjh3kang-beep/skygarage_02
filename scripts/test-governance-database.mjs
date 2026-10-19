import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

// Always starts a disposable LOCAL database. This runner intentionally cannot take
// a connection URL, production token or hosted project ID.
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const prerequisites=['tests/governance-bootstrap.sql','supabase/sql/platform-foundation.sql','supabase/sql/site-template-generator.sql','supabase/sql/platform-governance.sql','supabase/sql/platform-governance-catalog.sql'];
if(process.argv.includes('--wasm')){
 const {PGlite}=await import('@electric-sql/pglite');
 const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');
 const pg=await PGlite.create({extensions:{pgcrypto}});
 try{
  console.log('Local WASM PostgreSQL:',(await pg.query('show server_version')).rows[0].server_version);
  for(const file of prerequisites){await pg.exec(await readFile(join(root,file),'utf8'));console.log('Applied local prerequisite:',file);}
  const scheduler=await readFile(join(root,'supabase/sql/platform-governance-scheduler.sql'),'utf8');
  await pg.exec(scheduler.slice(scheduler.indexOf('create function'),scheduler.indexOf('select cron.schedule')));
  const results=await pg.exec(await readFile(join(root,'tests/governance-database.sql'),'utf8'));
  const report=results.flatMap(r=>r.rows??[]).find(r=>r.report)?.report;
  if(!report||report.passed<45)throw new Error('database verification report missing');
  console.log(JSON.stringify(report,null,2));console.log(`DATABASE_CHECKS_PASSED=${report.passed}`);
  console.log('Scope: single-connection WASM PostgreSQL SQL/RLS contracts. Native concurrency, hosted Auth/REST/cron and equipment are separate gates.');
 }catch(error){console.error(error.message);if(error.where)console.error(error.where);process.exitCode=1;}
 finally{await pg.close();}
 process.exit(process.exitCode??0);
}
if(process.getuid?.()===0)throw new Error('Run --wasm in a root-only container. Native PostgreSQL runner requires an existing non-root account.');
const dir=await mkdtemp(join(tmpdir(),'doelv-governance-'));
const port=25432+Math.floor(Math.random()*1000);
const db=new EmbeddedPostgres({databaseDir:join(dir,'data'),port,user:'postgres',password:randomBytes(24).toString('hex'),persistent:false,createPostgresUser:false,postgresFlags:['-c','listen_addresses=127.0.0.1','-c','unix_socket_directories='],onLog:()=>{},onError:()=>{}});
let client;let started=false;
try{
 await db.initialise();await db.start();started=true;
 client=db.getPgClient('postgres','127.0.0.1');await client.connect();
 console.log('Local PostgreSQL:',(await client.query('show server_version')).rows[0].server_version);
 for(const file of prerequisites){
  await client.query(await readFile(join(root,file),'utf8'));console.log('Applied local prerequisite:',file);
 }
 // Run the identical maintenance FUNCTION. pg_cron itself belongs to the hosted
 // extension; its installation/scheduling remains an explicit deployment check.
 const scheduler=await readFile(join(root,'supabase/sql/platform-governance-scheduler.sql'),'utf8');
 const functionOnly=scheduler.slice(scheduler.indexOf('create function'),scheduler.indexOf("select cron.schedule"));
 await client.query(functionOnly);
 const results=await client.query(await readFile(join(root,'tests/governance-database.sql'),'utf8'));
 const report=results.flatMap(r=>r.rows??[]).find(r=>r.report)?.report;
 if(!report||report.passed<45)throw new Error('database verification report missing');
 console.log(JSON.stringify(report,null,2));
 // Real concurrency: independent transactions contend on the same request ID.
 const actor=(await client.query("insert into auth.users default values returning id")).rows[0].id;
 await client.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[actor]);
 const request=(await client.query('select gen_random_uuid() id')).rows[0].id;
 const clients=Array.from({length:8},()=>db.getPgClient('postgres','127.0.0.1'));
 try{
  const ids=await Promise.all(clients.map(async c=>{await c.connect();await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'})]);await c.query('set local role authenticated');const r=await c.query('select public.platform_create_organization($1,$2) id',[request,'동시성 검증 조직']);await c.query('commit');return r.rows[0].id;}));
  if(new Set(ids).size!==1)throw new Error('concurrent idempotency failed');
  console.log('Concurrent request test: 8 transactions -> 1 organization identity');
 }finally{await Promise.all(clients.map(c=>c.end().catch(()=>{})));}
 console.log(`DATABASE_CHECKS_PASSED=${report.passed+1}`);
 console.log('Scope: disposable PG17 SQL/RLS/contracts; hosted Auth, REST, cron scheduler and physical equipment not tested.');
}catch(error){console.error(error.message);if(error.where)console.error(error.where);process.exitCode=1;}
finally{if(client)await client.end().catch(()=>{});if(started)await db.stop();await rm(dir,{recursive:true,force:true});}

if(process.exitCode)process.exit(process.exitCode);

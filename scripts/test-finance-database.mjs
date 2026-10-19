import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {runScenarios} from '../tests/finance-scenarios.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const stage=Number(process.argv.find(x=>x.startsWith('--stage='))?.split('=')[1]??3);
let db,client,dir,close,query,exec;
try {
 if(process.argv.includes('--wasm')){
  const {PGlite}=await import('@electric-sql/pglite');const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');
  db=await PGlite.create({extensions:{pgcrypto}});query=(q,p)=>db.query(q,p);exec=q=>db.exec(q);close=()=>db.close();
 }else{
  if(process.getuid?.()===0)throw new Error('Native runner needs existing non-root account. Use --wasm here.');
  const {default:EmbeddedPostgres}=await import('embedded-postgres');dir=await mkdtemp(join(tmpdir(),'doelv-finance-'));
  db=new EmbeddedPostgres({databaseDir:join(dir,'data'),port:26500+Math.floor(Math.random()*1000),user:'postgres',password:randomBytes(24).toString('hex'),persistent:false,createPostgresUser:false,postgresFlags:['-c','listen_addresses=127.0.0.1','-c','unix_socket_directories='],onLog:()=>{},onError:()=>{}});
  await db.initialise();await db.start();client=db.getPgClient('postgres','127.0.0.1');await client.connect();query=(q,p)=>client.query(q,p);exec=q=>client.query(q);close=async()=>{await client.end();await db.stop();await rm(dir,{recursive:true,force:true});};
 }
 console.log('FINANCE_ENGINE', (await query('show server_version')).rows[0].server_version);
 await exec(await readFile(join(root,'tests/governance-bootstrap.sql'),'utf8'));
 await runScenarios({query,exec,stage,apply:async n=>{await exec('reset role');await exec(await readFile(join(root,`supabase/sql/finance-0${n}-${['core','payments','accounting'][n-1]}.sql`),'utf8'));},native:process.argv.includes('--wasm')?null:db});
}catch(e){console.error(e.stack);if(e.where)console.error(e.where);process.exitCode=1;}finally{if(close)await close();}

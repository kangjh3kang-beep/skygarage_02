// Synthetic disposable SQL only: not hosted JWT/REST or production acceptance.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import EmbeddedPostgres from 'embedded-postgres';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export async function inquiryDatabase() {
  let pg, connect;
  if (process.env.INQUIRY_NATIVE === '1') {
    const dir = await mkdtemp(join(tmpdir(), 'doelv-inquiries-'));
    const db = new EmbeddedPostgres({ databaseDir: join(dir, 'data'), port: 32000 + Math.floor(Math.random() * 1000), user: 'postgres', password: randomUUID(), persistent: false, createPostgresUser: false, postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'unix_socket_directories='], onLog: () => {}, onError: () => {} });
    await db.initialise(); await db.start();
    connect = async () => { const client = db.getPgClient('postgres', '127.0.0.1'); await client.connect(); return client; };
    const client = await connect();
    pg = { exec: q => client.query(q), query: (...args) => client.query(...args), close: async () => { await client.end(); await db.stop(); await rm(dir, { recursive: true, force: true }); } };
  } else pg = await PGlite.create({ extensions: { pgcrypto } });
  const root = new URL('../../', import.meta.url);
  try {
    for (const path of ['tests/governance-bootstrap.sql', 'supabase/migrations/20260515042020_create_inquiries_table.sql', 'supabase/migrations/20260515223120_create_admin_notifications_table.sql']) await pg.exec(await readFile(new URL(path, root), 'utf8'));
    // Simulate broad legacy grants plus manually added policies/column grants.
    await pg.exec(`grant select,insert,update,delete on public.admin_notifications to authenticated; grant all on public.inquiries to anon,authenticated; grant insert(company,name,phone,email,project_type,message),update(status) on public.inquiries to anon,authenticated;
      grant usage on sequence public.inquiry_id_seq to anon,authenticated;
      create policy inquiries_admin_all on public.inquiries for all to authenticated using(true) with check(true);
      insert into public.inquiries(id,company,name,phone,email,reply_content,replied_at,admin_notes,status_history) values('LEGACY','SYNTHETIC','TEST','000','synthetic@example.invalid','OLD REPLY',now(),'[{"content":"legacy note"}]','[{"status":"접수대기"}]');`);
    await pg.exec(await readFile(new URL('supabase/sql/corporate-inquiries.sql', root), 'utf8'));
    const ids = Object.fromEntries(['admin', 'otherAdmin', 'member', 'operator'].map(k => [k, randomUUID()]));
    for (const [name,id] of Object.entries(ids)) {
      await pg.query('insert into auth.users(id) values($1)', [id]);
      if (name !== 'member') await pg.query('insert into public.user_roles(user_id,role) values($1,$2)', [id,name === 'operator' ? 'operator' : 'super_admin']);
    }
    let tail = Promise.resolve();
    const execute = async (client, actor, sql, params, aal, role) => {
      await client.query(`set role ${role}`);
      await client.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({sub:actor,role,aal,user_metadata:{role:'super_admin'}})]);
      try { return await client.query(sql,params); } finally { await client.query('reset role'); }
    };
    const as = (actor,sql,params=[],aal='aal2',role='authenticated') => {
      const work = tail.then(() => execute(pg,actor,sql,params,aal,role)); tail = work.catch(() => {}); return work;
    };
    const call = async (actor,name,args={},aal='aal2',role='authenticated') => {
      const keys=Object.keys(args);
      return (await as(actor,`select public.${name}(${keys.map((k,n)=>`${k}=>$${n+1}`).join(',')}) result`,keys.map(k=>typeof args[k]==='object'&&args[k]!==null?JSON.stringify(args[k]):args[k]),aal,role)).rows[0].result;
    };
    const command = (actor,action,payload,key=randomUUID(),aal='aal2') => call(actor,'platform_inquiry_command',{p_request_id:key,p_action:action,p_payload:payload},aal);
    const seed = async (id=randomUUID()) => { await pg.query("insert into public.inquiries(id,company,name,phone,email,message) values($1,'SYNTHETIC COMPANY','TEST CONTACT','000-0000','synthetic@example.invalid','SYNTHETIC MESSAGE')",[id]);return id; };
    return {pg,ids,as,call,command,seed,close:()=>pg.close(),concurrent:connect ? async(actor,sql,params=[]) => {const client=await connect();try{return await execute(client,actor,sql,params,'aal2','authenticated');}finally{await client.end();}} : null};
  } catch(error) { await pg.close(); throw error; }
}

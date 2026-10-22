import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { inquiryDatabase } from './helpers/inquiry-database.mjs';
let db, i;
before(async()=>{db=await inquiryDatabase();i=db.ids;});
after(async()=>{if(db)await db.close();});
const detail=id=>db.call(i.admin,'platform_inquiry_detail',{p_id:id});
const payload=(id,revision=1,extra={})=>({id,expected_revision:revision,...extra});

test('admin inquiry read requires current database role and MFA, never editable metadata',async()=>{
 for(const [actor,aal,error] of [[null,'aal2',/authentication_required/],[i.member,'aal2',/inquiry_access_denied/],[i.operator,'aal2',/inquiry_access_denied/],[i.admin,'aal1',/mfa_required/]])await assert.rejects(db.call(actor,'platform_inquiry_list',{},aal),error);
 await assert.rejects(db.call(null,'platform_inquiry_list',{},'aal1','anon'),/permission denied/);
 assert.ok(Array.isArray((await db.call(i.admin,'platform_inquiry_list')).rows));
});
test('legacy table and column grants cannot bypass admin RPC or overwrite history',async()=>{
 for(const actor of [i.member,i.admin]){
  await assert.rejects(db.as(actor,'select * from public.inquiries'),/permission denied/);
  await assert.rejects(db.as(actor,"update public.inquiries set status='답변완료'"),/permission denied/);
  await assert.rejects(db.as(actor,'delete from public.inquiries'),/permission denied/);
  await assert.rejects(db.as(actor,'select * from platform_private.inquiry_events'),/permission denied/);
 }
 await assert.rejects(db.as(null,"insert into public.inquiries(company,name,phone,email,status) values('S','T','000','test@example.invalid','답변완료')",[],'aal1','anon'),/permission denied/);
});
test('anonymous and signed-in public forms retain six-column insert, without response PII',async()=>{
 for(const [actor,role] of [[null,'anon'],[i.member,'authenticated']]){
  await db.as(actor,"insert into public.inquiries(company,name,phone,email,project_type,message) values('SYNTHETIC','TEST','000','test@example.invalid','mixed','TEST')",[],'aal1',role);
  await assert.rejects(db.as(actor,"insert into public.inquiries(company,name,phone,email) values('S','T','000','test@example.invalid') returning *",[],'aal1',role),/permission denied/);
 }
});
test('migration preserves legacy text IDs and history without asserting delivery',async()=>{
 const {inquiry}=await detail('LEGACY');assert.equal(inquiry.id,'LEGACY');assert.equal(inquiry.admin_notes[0].content,'legacy note');assert.equal(inquiry.status_history.length,1);assert.equal(inquiry.delivery_status,'legacy_unknown');assert.equal(inquiry.revision,1);
});
test('note is server-attributed, append-only, idempotent and detects payload conflicts',async()=>{
 const id=await db.seed(),key=randomUUID(),p=payload(id,1,{body:'Synthetic note'});
 const first=await db.command(i.admin,'note',p,key);assert.equal(first.revision,2);
 assert.deepEqual(await db.command(i.admin,'note',p,key),first);
 await assert.rejects(db.command(i.admin,'note',{...p,body:'Other'},key),/idempotency_conflict/);
 await assert.rejects(db.command(i.admin,'note',p),/version_conflict/);
 const {events,inquiry}=await detail(id);assert.equal(events.length,1);assert.equal(events[0].actor_id,i.admin);assert.equal(events[0].data.body,'Synthetic note');assert.deepEqual(inquiry.admin_notes,[]);
});
test('strict payload schemas reject extra keys, absent keys, wrong types and null commands',async()=>{
 const id=await db.seed();
 for(const p of [null,[],{},payload(id,1,{body:'ok',actor_id:i.member}),payload(id,1,{body:{text:'x'}}),payload(id,'1',{body:'ok'}),payload(id,1.2,{body:'ok'}),payload(id,0,{body:'ok'}),payload(id,1,{body:''}),payload(id,1,{body:'x'.repeat(2001)})])await assert.rejects(db.command(i.admin,'note',p),/invalid_inquiry_command|invalid_body/);
 await assert.rejects(db.command(i.admin,null,payload(id)),/invalid_inquiry_command/);
 await assert.rejects(db.command(i.admin,'note',payload(id,1,{body:'ok'}),null),/invalid_inquiry_command/);
 await db.command(i.admin,'note',payload(id,1,{body:'x'.repeat(2000)}));
});
test('assignment only accepts current platform administrators or explicit null',async()=>{
 const id=await db.seed();await assert.rejects(db.command(i.admin,'assign',payload(id,1,{assigned_to:i.member})),/invalid_assignee/);
 await assert.rejects(db.command(i.admin,'assign',payload(id,1,{assigned_to:'bad'})),/invalid_assignee/);
 assert.equal((await db.command(i.admin,'assign',payload(id,1,{assigned_to:i.otherAdmin}))).assigned_to,i.otherAdmin);
 assert.equal((await db.command(i.admin,'assign',payload(id,2,{assigned_to:null}))).assigned_to,null);
});
test('state machine requires draft before completion and distinguishes saved from sent',async()=>{
 const id=await db.seed();const state=(action,rev)=>db.command(i.admin,action,payload(id,rev,{reason:'Synthetic review'}));
 await assert.rejects(state('complete',1),/invalid_transition/);await state('start_review',1);
 await assert.rejects(state('complete',2),/reply_required/);
 const draft=await db.command(i.admin,'save_reply',payload(id,2,{body:'Synthetic answer'}));assert.equal(draft.status,'검토중');assert.equal(draft.delivery_status,'not_sent');assert.ok(draft.reply_saved_at);
 await state('hold',3);await state('resume',4);assert.equal((await state('complete',5)).status,'답변완료');
 await assert.rejects(db.command(i.admin,'save_reply',payload(id,6,{body:'Changed'})),/invalid_transition/);
 await state('reopen',6);const {inquiry}=await detail(id);assert.equal(inquiry.replied_at,null);assert.equal(inquiry.delivery_status,'not_sent');assert.equal(inquiry.revision,7);
});
test('reason and reply lengths are checked and failed transitions do not change revision',async()=>{
 const id=await db.seed();for(const reason of ['',true,'x'.repeat(501)])await assert.rejects(db.command(i.admin,'hold',payload(id,1,{reason})),/invalid_reason/);
 for(const body of ['',[], 'x'.repeat(5001)])await assert.rejects(db.command(i.admin,'save_reply',payload(id,1,{body})),/invalid_body/);
 await assert.rejects(db.command(i.admin,'resume',payload(id,1,{reason:'Synthetic'})),/invalid_transition/);
 assert.equal((await detail(id)).inquiry.revision,1);
});
test('revocation also prevents replay of an earlier successful command',async()=>{
 const id=await db.seed(),key=randomUUID(),p=payload(id,1,{body:'Synthetic'});await db.command(i.otherAdmin,'note',p,key);
 await db.pg.query("update public.user_roles set role='viewer' where user_id=$1",[i.otherAdmin]);
 try { await assert.rejects(db.command(i.otherAdmin,'note',p,key),/inquiry_access_denied/);await assert.rejects(db.call(i.otherAdmin,'platform_inquiry_detail',{p_id:id}),/inquiry_access_denied/); }
 finally {await db.pg.query("update public.user_roles set role='super_admin' where user_id=$1",[i.otherAdmin]);}
});
test('commands, events and revisions roll back together if audit persistence fails',async()=>{
 const id=await db.seed(),key=randomUUID(),p=payload(id,1,{body:'Synthetic'});
 await db.pg.exec("create function public.synthetic_audit_failure() returns trigger language plpgsql as $$ begin raise exception 'synthetic audit unavailable'; end $$; create trigger synthetic_failure before insert on platform_private.inquiry_events for each row execute function public.synthetic_audit_failure();");
 try {await assert.rejects(db.command(i.admin,'note',p,key),/synthetic audit unavailable/);}finally{await db.pg.exec('drop trigger synthetic_failure on platform_private.inquiry_events; drop function public.synthetic_audit_failure();');}
 assert.equal((await detail(id)).inquiry.revision,1);assert.equal((await db.pg.query('select count(*)::int n from platform_private.inquiry_commands where request_id=$1',[key])).rows[0].n,0);
 assert.equal((await db.command(i.admin,'note',p,key)).revision,2);
});
test('list and event cursors cover page boundaries without duplicating rows',async()=>{
 for(let n=0;n<55;n++)await db.seed(`PAGE-${String(n).padStart(3,'0')}`);
 let after=null,rows=[];do{const page=await db.call(i.admin,'platform_inquiry_list',{p_after:after});rows.push(...page.rows);after=page.next_cursor;}while(after);
 assert.equal(rows.length,(await db.pg.query('select count(*)::int n from public.inquiries')).rows[0].n);assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
 assert.equal('email' in rows[0],false);assert.equal('message' in rows[0],false);
 const id=await db.seed();for(let n=1;n<=52;n++)await db.command(i.admin,'note',payload(id,n,{body:`Synthetic ${n}`}));
 const a=await db.call(i.admin,'platform_inquiry_events',{p_id:id});const b=await db.call(i.admin,'platform_inquiry_events',{p_id:id,p_before:a.next_cursor});assert.equal(a.rows.length,50);assert.equal(b.rows.length,2);assert.equal(b.next_cursor,null);assert.equal(new Set([...a.rows,...b.rows].map(x=>x.id)).size,52);
});
test('filter, missing inquiry and cursor failures have stable safe errors',async()=>{
 await assert.rejects(db.call(i.admin,'platform_inquiry_list',{p_status:'bad'}),/invalid_inquiry_filter/);
 await assert.rejects(db.call(i.admin,'platform_inquiry_list',{p_status:null}),/invalid_inquiry_filter/);
 await assert.rejects(db.call(i.admin,'platform_inquiry_events',{p_id:'LEGACY',p_before:0}),/invalid_inquiry_cursor/);
 await assert.rejects(detail('does-not-exist'),/inquiry_unavailable/);
 await assert.rejects(db.command(i.admin,'note',payload('does-not-exist',1,{body:'Synthetic'})),/inquiry_unavailable/);
});
test('read access is audited without copying customer contact or reply content',async()=>{
 await db.call(i.admin,'platform_inquiry_list');await detail('LEGACY');await db.call(i.admin,'platform_inquiry_events',{p_id:'LEGACY'});
 const rows=(await db.pg.query('select * from platform_private.inquiry_access_events')).rows;assert.ok(rows.length>=3);assert.ok(rows.every(x=>x.actor_id));assert.equal(JSON.stringify(rows).includes('example.invalid'),false);
 await assert.rejects(db.as(i.admin,'delete from platform_private.inquiry_access_events'),/permission denied/);
});
test('independent PostgreSQL connections serialize stale edits and same-key retries', {skip:process.env.INQUIRY_NATIVE!=='1'},async()=>{
 const id=await db.seed(),sql='select public.platform_inquiry_command($1,$2,$3) result',p=payload(id,1,{body:'Synthetic race'});
 const results=await Promise.allSettled([i.admin,i.otherAdmin].map(actor=>db.concurrent(actor,sql,[randomUUID(),'note',JSON.stringify(p)])));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.match(results.find(x=>x.status==='rejected').reason.message,/version_conflict/);
 const key=randomUUID(),next=payload(id,2,{body:'Synthetic retry'});const repeats=await Promise.all([1,2].map(()=>db.concurrent(i.admin,sql,[key,'note',JSON.stringify(next)])));assert.deepEqual(repeats[0].rows,repeats[1].rows);assert.equal((await detail(id)).events.length,2);
});
test('migration is exactly the independently tested SQL',async()=>{
 const {readdir}=await import('node:fs/promises');const files=await readdir(new URL('../supabase/migrations/',import.meta.url));const migration=files.find(x=>x.endsWith('_corporate_inquiry_admin.sql'));assert.ok(migration);
 assert.equal(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),'utf8'),await readFile(new URL('../supabase/sql/corporate-inquiries.sql',import.meta.url),'utf8'));
});

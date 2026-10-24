import { JSDOM } from 'jsdom';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://harness.invalid/',pretendToBeVisual:true});
for(const key of ['window','document','navigator','DocumentFragment','ShadowRoot','SVGElement','HTMLSelectElement','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Element','Node','MutationObserver','localStorage','sessionStorage','getComputedStyle','MouseEvent','Event','PopStateEvent'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true,writable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
class Observer { observe(){} unobserve(){} disconnect(){} }
globalThis.IntersectionObserver=Observer;globalThis.ResizeObserver=Observer;
window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}});
window.scrollTo=()=>{};
const id='11111111-1111-4111-8111-111111111111';
const error={code:'42501',message:'HARNESS permission denied'};
const authListeners = new Set();
export const syntheticMfaSecret = 'HARNESS-NOT-A-REAL-TOTP-KEY';
export function emitAuthChange() { for (const fn of authListeners) fn('SIGNED_IN', session()); }
export const state={mode:'healthy',role:'super_admin',aal:'aal2',loggedIn:true,actor:id,rpcExecutor:null,tableExecutor:null,functionExecutor:null,calls:[],writeError:false,factors:null,mfaEnrollExecutor:null,mfaVerifyUpgrades:false,versionError:false};
export function reset(mode='healthy') {state.mode=mode;state.actor=id;state.rpcExecutor=null;state.tableExecutor=null;state.functionExecutor=null;state.role='super_admin';state.aal='aal2';state.loggedIn=true;state.calls=[];state.writeError=false;state.factors=null;state.mfaEnrollExecutor=null;state.mfaVerifyUpgrades=false;state.versionError=false;localStorage.clear();sessionStorage.clear();if(mode==='populated')localStorage.setItem('sgp_selected_complex',id);}
const book={id,code:'TEST',name:'가상 시험 장부',environment:'sandbox',currency:'KRW',finance_source:true,closed_through:null};
function rpc(name) {
 if(name==='platform_live_auth_report')return null;
 if(name==='platform_service_request_snapshot')return {schema_version:1,site_id:null,headquarters:true,can_manage:true,rows:[],counts:{open:0,unassigned:0,overdue:0},assignees:[],next_cursor:null,observed_at:'2026-10-24T00:00:00Z'};
 if(name==='platform_my_service_requests')return {schema_version:1,rows:state.mode==='populated'?[{id,site_id:null,site_name:null,subject:'가상 방문 문의',description:'가상 현장 방문 확인',status:'submitted',category:'visit',response:null,created_at:'2026-10-19T00:00:00Z',due_at:null,reviewed_at:null,overdue:false}]:[],observed_at:'2026-10-24T00:00:00Z'};
 if(name==='platform_my_memberships')return {schema_version:1,applications:[],memberships:[],observed_at:'2026-10-21T00:00:00Z'};
 if(name==='platform_governance_directory')return {schema_version:1,observed_at:'2026-10-19T00:00:00Z',headquarters:true,operators:[],assignments:[],organizations:[],sites:[]};
 if(name==='platform_readiness_snapshot')return {schema_version:1,observed_at:'2026-10-19T00:00:00Z',counts:Object.fromEntries(['sites','blueprints','memberships','requests','devices','commands','telemetry','domain_events','ai_models','ai_actions','hil_records'].map(k=>[k,0])),security:{public_tables_without_rls:0,legacy_browser_grants:0}};
 if(name==='finance_snapshot')return {schema_version:1,environment:'sandbox',live_enabled:false,actor:id,observed_at:'2026-10-19T00:00:00Z',wallet_balance:'10000',home_facility_id:null,closed_through:null,facilities:[],payments:[],batches:[],accounts:[],exports:[],counts:{payments:0,journals:0,batches:0,exports:0},reconciliation:{passed:true,balanced:true,wallets_nonnegative:true,payments_match:true,refunds_match:true,facility_payables_match:true,external_bank_verified:false,external_erp_verified:false}};
 if(name==='erp_snapshot')return {schema_version:1,environment:'sandbox',actor:id,book,books:[book],accounts:[],parties:[],cost_centers:[],vouchers:[],counts:{vouchers:0,posted:0,draft:0},imports:[],import_count:0,pending_exports:[],providers:['payment','payout'].map(kind=>({kind,vendor_code:null,label:null,status:'unassigned',live_enabled:false,version:'1'})),audit:[],reconciliation:{balanced:true,draft_count:0,source_connected:true,source_unexported:0,source_unposted:0,source_mismatches:0,source_reconciled:true,external_bank_verified:false}};
 if(name==='erp_report')return {schema_version:1,environment:'sandbox',book_id:id,from_date:'2026-10-01',to_date:'2026-10-19',cost_center_id:null,trial_balance:[],profit_loss:{income:'0',expense:'0',profit:'0'},balance_sheet:{assets:'0',liabilities:'0',equity:'0',accumulated_result:'0',difference:'0'},party_balances:[],ledger:[],next_after:null,aggregates_cover_all_posted_entries:true,external_bank_verified:false,statutory_report:false};
 return null;
}
function dataFor(table,single) {
 if(table==='complexes'&&single)return {id,name:'가상 검증 단지',code:'TEST',address:'가상 시험 주소',region:'TEST',status:'active',lat:null,lng:null};
 if(table==='households'&&single)return {id,user_id:id,complex_id:id,unit_number:'TEST-101',status:'active'};
 if(table==='user_roles')return {role:state.role,display_name:'가상 관리자'};
 if(table==='sgp_users')return {id:state.actor,is_verified:true,phone_verified_at:'2026-10-01T00:00:00Z',display_name:'가상 사용자',phone:'',status:'active',created_at:'2026-10-19T00:00:00Z'};
 if(table==='sgp_coin_wallets')return {id,user_id:id,balance:0};
 if(table==='sgp_service_requests'&&state.mode==='populated')return [{id,subject:'가상 방문 문의',description:'가상 현장 방문 확인',status:'submitted',category:'visit',response:null,created_at:'2026-10-19T00:00:00Z'}];
 if(table==='platform_site_members'&&state.mode==='populated')return [{site_id:id,status:'active',unit_label:'가상 101호',site:{id,name:'가상 검증 단지',phase:'sandbox'}}];
 if(table==='platform_resident_vehicles'&&state.mode==='populated')return [{id,plate:'TEST-ONLY',model:'가상 검증 차량',status:'verified'}];
 return single?null:[];
}
function query(kind,name,payload) {
 let single=false,mutation=false;const operations=[];
 const actor=state.actor;
 const result=async()=>{state.calls.push({kind,name,mutation,payload});const fail=(state.mode==='error'&&name!=='user_roles'&&name!=='sgp_users')||(mutation&&state.writeError);if(!fail&&kind==='table'&&state.tableExecutor)return state.tableExecutor(name,{single,operations,payload,mutation},actor);if(!fail&&kind==='rpc'&&state.rpcExecutor)return state.rpcExecutor(name,payload,actor);return {data:fail?null:kind==='rpc'?rpc(name):dataFor(name,single),error:fail?error:null,count:0};};
 const proxy=new Proxy({}, {get(_target,key){
  if(key==='then')return (resolve,reject)=>Promise.resolve().then(result).then(resolve,reject);
  if(key==='catch')return reject=>Promise.resolve().then(result).catch(reject);
  if(key==='finally')return cb=>Promise.resolve().then(result).finally(cb);
  return (...args)=>{operations.push({method:key,args});if(['single','maybeSingle'].includes(key))single=true;if(['insert','update','delete','upsert'].includes(key)){mutation=true;payload=args[0];}return proxy;};
 }});return proxy;
}
const user=()=>state.loggedIn?{id:state.actor,email:'synthetic@example.invalid',app_metadata:{},user_metadata:{}}:null;
const session=()=>state.loggedIn?{user:user(),access_token:'synthetic-not-a-token'}:null;
globalThis.__harnessSupabase={
 from:name=>query('table',name),rpc:(name,payload)=>query('rpc',name,payload),
 channel:()=>{const c={on:()=>c,subscribe:()=>c,unsubscribe:async()=>{}};return c;},removeChannel:async()=>{},
 auth:{getSession:async()=>({data:{session:session()},error:null}),getUser:async()=>({data:{user:user()},error:null}),onAuthStateChange:fn=>{authListeners.add(fn);return {data:{subscription:{unsubscribe(){authListeners.delete(fn);}}}};},signOut:async()=>({error:null}),
  mfa:{
   getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:state.aal,nextLevel:'aal2'},error:null}),
   listFactors:async()=>{const all=state.factors??(state.aal==='aal1'?[]:[{id,status:'verified',factor_type:'totp'}]);return {data:{all,totp:all.filter(f=>f.status==='verified'&&f.factor_type==='totp')},error:null};},
   enroll:async()=>{state.calls.push({kind:'auth',name:'mfa.enroll',mutation:true});if(state.mfaEnrollExecutor)return state.mfaEnrollExecutor();state.factors=[...(state.factors??[]),{id,status:'unverified',factor_type:'totp'}];return {data:{id,totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg"/>',secret:syntheticMfaSecret}},error:null};},
   unenroll:async({factorId})=>{state.calls.push({kind:'auth',name:'mfa.unenroll',mutation:true,factorId});state.factors=state.factors.filter(f=>f.id!==factorId);return {error:null};},
   challengeAndVerify:async()=>{state.calls.push({kind:'auth',name:'mfa.verify',mutation:true});if(!state.writeError&&state.mfaVerifyUpgrades){state.aal='aal2';state.factors=state.factors?.map(f=>({...f,status:'verified'}))??null;}return {error:state.writeError?error:null};}
  }},
 storage:{from:()=>({list:async()=>({data:[],error:null}),getPublicUrl:()=>({data:{publicUrl:'https://harness.invalid/image.png'}})})},
 functions:{invoke:async (name,options)=>{state.calls.push({kind:'function',name,payload:options?.body});if(state.functionExecutor)return state.functionExecutor(name,options);return {data:null,error:{message:'commissioning_required'}};}},
};
globalThis.fetch=async url=>{state.calls.push({kind:'http',name:String(url)});if(String(url).includes('app-version.json'))return new Response(JSON.stringify(state.versionError?{release:'local-unconfirmed'}:{release:'b0219e0eca6a0bc3f6bb7dee61da0f5629d074a3'}));return new Response(JSON.stringify({error:'HARNESS network blocked'}),{status:503});};
registerHooks({
 resolve(specifier,context,next) {
  if(specifier.endsWith('/lib/supabase')||specifier.endsWith('/lib/supabase.ts'))return {url:'harness:supabase',shortCircuit:true};
  if((specifier.startsWith('.')||specifier.startsWith('/'))&&context.parentURL?.startsWith('file:')) {
   const url=new URL(specifier,context.parentURL),base=fileURLToPath(url);
   if(/\.(css|svg|png|jpe?g|webp|mp4|woff2?)$/.test(base))return {url:'harness:asset/'+encodeURIComponent(base),shortCircuit:true};
   const found=[base,base+'.ts',base+'.tsx',base+'/index.ts',base+'/index.tsx'].find(f=>existsSync(f)&&statSync(f).isFile());
   if(found)return {url:pathToFileURL(found).href,shortCircuit:true};
  }
  return next(specifier,context);
 },
 load(url,context,next) {
  if(url.startsWith('file:')&&/\.(css|svg|png|jpe?g|webp|mp4|woff2?)$/.test(url))return {format:'module',source:'export default "harness-asset";',shortCircuit:true};
  if(url==='harness:supabase')return {format:'module',source:'export const supabase=globalThis.__harnessSupabase;',shortCircuit:true};
  if(url.startsWith('harness:asset/'))return {format:'module',source:'export default "harness-asset";',shortCircuit:true};
  if(url.startsWith(pathToFileURL(root+'/src/').href)&&/\.tsx?$/.test(url)) {
   const source=readFileSync(fileURLToPath(url),'utf8').replaceAll('import.meta.env','({VITE_SUPABASE_URL:"https://harness.invalid",VITE_SUPABASE_ANON_KEY:"synthetic",DEV:false,PROD:true})');
   return {format:'module',source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
  }
  if(url.startsWith(pathToFileURL(root+'/src/').href)&&url.endsWith('.json'))return {format:'module',source:'export default '+readFileSync(fileURLToPath(url),'utf8')+';',shortCircuit:true};
  return next(url,context);
 }
});

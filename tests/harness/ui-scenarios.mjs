import { state, reset } from './browser-runtime.mjs';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const React=await import('react');
const {render,cleanup,waitFor,fireEvent}=await import('@testing-library/react');
const {MemoryRouter}=await import('react-router-dom');
const {ThemeProvider,createTheme}=await import('@mui/material/styles');
const {default:App}=await import('../../src/App.tsx');
const inventory=JSON.parse(readFileSync(new URL('../../src/lib/page-inventory.json',import.meta.url),'utf8'));
const findings=[];
const el=React.createElement;
async function open(path){window.history.replaceState({},'',path);const view=render(el(App));await waitFor(()=>assert.ok(view.container.textContent.trim().length>0),{timeout:15000});return view;}
afterEach(()=>cleanup());
const theme=createTheme();
const wrap=(node,path='/admin')=>el(MemoryRouter,{initialEntries:[path]},el(ThemeProvider,{theme},node));

test('every declared path renders a route, documented gate or fallback with synthetic data',async()=>{
 for(const mode of ['healthy','error','populated'])for(const route of inventory.routes.filter(r=>!process.env.HARNESS_PATH||r.path===process.env.HARNESS_PATH)){
  reset(mode);
  const path=route.path.replace(':vehicleId','synthetic-vehicle').replace(':id','synthetic-record').replace('*','not-found-harness');
  try {
   const view=await open(path);
   await waitFor(()=>assert.ok(!/페이지를 불러오는 중 문제가 발생했습니다|예상치 못한 오류/.test(view.container.textContent)),{timeout:1000});
   if(route.mode==='commissioning')assert.match(view.container.textContent,/현장별 권한·데이터 연결과 인수/);
   if(route.path==='/admin/settlement')await waitFor(()=>assert.match(view.container.textContent,/결제·정산·회계 검증/));
   if(route.path==='/admin/erp')await waitFor(()=>assert.match(view.container.textContent,/자체 ERP/));
   assert.equal(state.calls.some(c=>c.mutation),false,'route mount must not seed or mutate data');
   console.log('ROUTE',mode,route.path);
   findings.push({path:route.path,mode,result:'rendered',availability:route.mode,backend:'synthetic',field_acceptance:false});
  }catch(e){findings.push({path:route.path,mode,result:'failed',error:e.message.slice(0,500)});}
  finally{cleanup();}
 }
 mkdirSync(new URL('../../artifacts/',import.meta.url),{recursive:true});
 writeFileSync(new URL('../../artifacts/ui-harness.json',import.meta.url),JSON.stringify({scope:'jsdom route rendering with synthetic backend; not browser/Auth/field E2E',results:findings},null,2));
 const failures=findings.filter(x=>x.result==='failed');
 assert.deepEqual(failures,[]);
});

test('available finance and ERP routes mount their real components through the parent gate',async()=>{
 const {default:Gate}=await import('../../src/admin/components/AdminPageGate.tsx');
 for(const path of ['/admin/erp','/admin/erp/','/admin/settlement','/admin/validation']){
  const v=render(wrap(el(Gate,null,el('h1',null,'mounted actual child')),path));assert.match(v.container.textContent,/mounted actual child/);cleanup();
 }
 const v=render(wrap(el(Gate,null,el('h1',null,'unsafe child')),'/admin/workflows'));assert.doesNotMatch(v.container.textContent,/unsafe child/);cleanup();
});

test('MFA guidance is visible and verification without aal2 never grants access',async()=>{
 reset();state.aal='aal1';const v=await open('/admin/erp');await waitFor(()=>assert.match(v.container.textContent,/Google Authenticator/));assert.doesNotMatch(v.container.textContent,/자체 ERP 회계/);
 fireEvent.click(v.getByRole('button',{name:'인증 앱 등록하기'}));await waitFor(()=>assert.ok(v.getByLabelText('인증 앱 6자리 번호')));
 fireEvent.change(v.getByLabelText('인증 앱 6자리 번호'),{target:{value:'123456'}});fireEvent.click(v.getByRole('button',{name:'인증하고 관리 화면 열기'}));
 await waitFor(()=>assert.match(v.container.textContent,/자동 시간 설정/));assert.doesNotMatch(v.container.textContent,/시험 장부/);cleanup();
});

test('workflow failed save preserves dialog and does not issue a success audit',async()=>{
 reset();const {default:Workflow}=await import('../../src/admin/pages/WorkflowManager.tsx');const v=render(wrap(el(Workflow)));
 await waitFor(()=>assert.ok(v.getByRole('button',{name:/워크플로우 추가|정의 추가|새 워크플로우|정의 생성/})));
 fireEvent.click(v.getByRole('button',{name:/워크플로우 추가|정의 추가|새 워크플로우|정의 생성/}));
 const dialog=await v.findByRole('dialog');const inputs=[...dialog.querySelectorAll('input')];
 assert.ok(inputs.length>=2);fireEvent.change(inputs[0],{target:{value:'가상 저장 실패 시험'}});
 const trigger=v.getByLabelText('트리거 이벤트');fireEvent.change(trigger,{target:{value:'test.event'}});
 state.writeError=true;
 const save=[...dialog.querySelectorAll('button')].find(x=>/저장|추가/.test(x.textContent));assert.ok(save);fireEvent.click(save);
 await waitFor(()=>assert.match(v.container.textContent,/권한 또는 인증/));assert.ok(v.getByRole('dialog'));assert.equal(state.calls.some(c=>c.name==='security_audit_logs'&&c.mutation),false);cleanup();
});

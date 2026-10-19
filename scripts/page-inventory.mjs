import ts from 'typescript';
import {adminAvailableRoutes} from '../src/lib/route-access.ts';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
function walk(dir) { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = resolve(dir,e.name); if(e.isDirectory()) walk(p); else if(/\.tsx?$/.test(e.name)) files.push(p); } }
walk(resolve(root,'src'));
const models = new Map();
const local = (file, specifier) => {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(file),specifier);
  return [base,base+'.ts',base+'.tsx',base+'/index.ts',base+'/index.tsx'].find(p=>existsSync(p)&&/\.tsx?$/.test(p)) || null;
};
for (const file of files) {
  const source = readFileSync(file,'utf8');
  const ast = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  if(ast.parseDiagnostics.length) throw new Error(`Cannot inventory invalid syntax: ${relative(root,file)}`);
  const model = { source, ast, imports:[], tables:[], rpcs:[], functions:[], links:[], actions:[], unresolvedActions:[] };
  function visit(n) {
    if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)) { const target=local(file,n.moduleSpecifier.text); if(target)model.imports.push(target); }
    if(ts.isCallExpression(n)) {
      const a=n.arguments[0], value=a&&ts.isStringLiteral(a)?a.text:null;
      if(ts.isPropertyAccessExpression(n.expression)&&value) {
        const method=n.expression.name.text;
        if(method==='from'&&n.expression.expression.getText(ast).includes('supabase'))model.tables.push(value);
        if(method==='rpc')model.rpcs.push(value);
        if(method==='invoke')model.functions.push(value);
      }
      if(ts.isIdentifier(n.expression)&&n.expression.text==='navigate'&&value?.startsWith('/'))model.links.push(value);
    }
    if(ts.isPropertyAssignment(n)&&n.name.getText(ast)==='path'&&ts.isStringLiteral(n.initializer)&&n.initializer.text.startsWith('/'))model.links.push(n.initializer.text);
    if(ts.isJsxAttribute(n)&&['href','to'].includes(n.name.getText(ast))&&n.initializer&&ts.isStringLiteral(n.initializer)&&n.initializer.text.startsWith('/'))model.links.push(n.initializer.text);
    if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)) {
      const name=n.tagName.getText(ast);
      if(['Button','IconButton','button'].includes(name)) {
        const attrs=n.attributes.properties.filter(ts.isJsxAttribute).map(x=>x.name.getText(ast));
        const label=relative(root,file)+':'+(ast.getLineAndCharacterOfPosition(n.pos).line+1);
        model.actions.push(label);
        if(!attrs.some(x=>['onClick','href','to','type','disabled','component'].includes(x)))model.unresolvedActions.push(label);
      }
    }
    ts.forEachChild(n,visit);
  }
  for(const m of source.matchAll(/functions\/v1\/([a-z][a-z0-9-]*)/g))model.functions.push(m[1]);
  visit(ast); models.set(file,model);
}
const appFile=resolve(root,'src/App.tsx'), app=models.get(appFile), components=new Map();
for(const statement of app.ast.statements) {
  if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations) {
    if(!ts.isIdentifier(d.name)||!d.initializer)continue;
    const match=d.initializer.getText(app.ast).match(/import\(['"]([^'"]+)['"]\)/);
    if(match)components.set(d.name.text,{file:local(appFile,match[1]),exportName:d.initializer.getText(app.ast).match(/default:\s*m\.(\w+)/)?.[1]||'default'});
  }
  if(ts.isImportDeclaration(statement)&&statement.importClause?.name){const file=local(appFile,statement.moduleSpecifier.text);if(file)components.set(statement.importClause.name.text,{file,exportName:'default'});}
}
const scopes={TrackingGuard:'/tracking',SgpAppGuard:'/app',ParkingAppGuard:'/parking',VisitorRoutes:'/visitor',ProtectedRoutes:'/admin',App:''};
const routes=[];
for(const statement of app.ast.statements) {
 if(!ts.isFunctionDeclaration(statement)||!(statement.name?.text in scopes))continue;
 const scope=scopes[statement.name.text];
 function visit(n) {
  if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(app.ast)==='Route') {
   const attrs=Object.fromEntries(n.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(app.ast),a.initializer]));
   const path=attrs.path&&ts.isStringLiteral(attrs.path)?attrs.path.text:'';
   if(path.endsWith('/*')) { ts.forEachChild(n,visit); return; }
   const element=attrs.element?.getText(app.ast)||'';
   const name=element.match(/^\{<(\w+)/)?.[1];
   const component=components.get(name);
   const redirect=element.match(/<Navigate\s+to="([^"]+)"/)?.[1];
   if(component||redirect)routes.push({path:(scope+'/'+path).replace(/\/+$/,'')||'/',component:name,file:component?relative(root,component.file):null,exportName:component?.exportName||null,redirect:redirect||null});
  }
  ts.forEachChild(n,visit);
 }
 visit(statement);
}
function graph(file, seen=new Set()) {if(!file||seen.has(file)||!models.has(file))return seen;seen.add(file);for(const f of models.get(file).imports)graph(f,seen);return seen;}
const available=adminAvailableRoutes;
const uniq=a=>[...new Set(a)].sort();
for(const route of routes) {
 const parents={'admin':'src/admin/AdminLayout.tsx','parking':'src/parking/ParkingLayout.tsx','tracking':'src/tracking/TrackingLayout.tsx','app':'src/sgp/SgpLayout.tsx'};
 const seen=graph(route.file?resolve(root,route.file):null);const layout=parents[route.path.split('/')[1]];if(layout)graph(resolve(root,layout),seen);
 const deps=[...seen].map(f=>models.get(f));
 route.tables=uniq(deps.flatMap(d=>d.tables));route.rpcs=uniq(deps.flatMap(d=>d.rpcs));route.functions=uniq(deps.flatMap(d=>d.functions));
 route.links=uniq(deps.flatMap(d=>d.links));route.actions=deps.reduce((n,d)=>n+d.actions.length,0);route.actionReview=uniq(deps.flatMap(d=>d.unresolvedActions));
 route.mode=route.redirect?'redirect':route.path.includes('*')?'fallback':route.path.startsWith('/admin')&&!available.includes(route.path)?'commissioning':['/admin/settlement','/admin/erp'].includes(route.path)?'sandbox':route.path.startsWith('/parking')||route.path.startsWith('/visitor')||route.path.startsWith('/tracking')?'legacy-review':['/app/call','/app/access','/app/wallet','/app/pay'].includes(route.path)?'limited':'available';
 route.note=({commissioning:'상위 화면에서 실행 차단 · 서버/현장 인수 필요',sandbox:'관리자 시험 데이터만 사용 · 실결제/은행 지급 미연결','legacy-review':'기존 화면 · 실제 운영 인수 미완료',limited:'안내·요청만 제공 · 실제 결제/장비/출입 미연결',available:'화면 연결 · 업무별 실사용 인수는 별도',redirect:'기존 주소 연결',fallback:'없는 주소 안내'})[route.mode];
}
const directlyRouted=new Set(routes.map(r=>r.file));
const allPageFiles=files.filter(f=>/\/pages\/.*\.tsx$/.test(f)).map(f=>relative(root,f));
const inventory={schemaVersion:1,source:'src/App.tsx + local import graph',scope:'Static inventory; runtime checks and field acceptance are separate.',routes:routes.sort((a,b)=>a.path.localeCompare(b.path)),staticPages:[{path:'/app-update',file:'public/app-update.html'},{path:'/offline',file:'public/offline.html'}],pageFiles:allPageFiles.sort(),notDirectlyRouted:allPageFiles.filter(f=>!directlyRouted.has(f)).sort(),sourceFiles:files.length};
export {inventory};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const target=resolve(root,'src/lib/page-inventory.json'),next=JSON.stringify(inventory,null,2)+'\n';
 if(process.argv.includes('--check')) {if(!existsSync(target)||readFileSync(target,'utf8')!==next)throw new Error('Page inventory is stale. Run npm run inventory.');}
 else writeFileSync(target,next);
 console.log(JSON.stringify({routes:routes.length,pageFiles:allPageFiles.length,notDirectlyRouted:inventory.notDirectlyRouted.length,modes:routes.reduce((a,r)=>(a[r.mode]=(a[r.mode]||0)+1,a),{})}));
}

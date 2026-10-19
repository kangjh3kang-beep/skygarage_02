import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inventory} from '../scripts/page-inventory.mjs';
import {adminAvailableRoutes,isAdminPageAvailable,adminPageMode} from '../src/lib/route-access.ts';
import {matchPath} from 'react-router-dom';
test('all routes are unique and available routes have a connected component',()=>{
 assert.equal(new Set(inventory.routes.map(r=>r.path)).size,inventory.routes.length);
 for(const path of adminAvailableRoutes){const r=inventory.routes.find(r=>r.path===path);assert.ok(r?.file,path);assert.ok(['available','sandbox'].includes(r.mode));}
});
test('inventory is current and every unmounted page is explicitly listed',()=>{
 assert.deepEqual(JSON.parse(readFileSync(new URL('../src/lib/page-inventory.json',import.meta.url))),inventory);
 assert.equal(new Set(inventory.pageFiles).size,inventory.pageFiles.length);
 for(const f of inventory.pageFiles)assert.ok(inventory.routes.some(r=>r.file===f)||inventory.notDirectlyRouted.includes(f));
});
test('route availability is exact and preserves uncommissioned module barriers',()=>{
 assert.equal(isAdminPageAvailable('/admin/erp/'),true);assert.equal(adminPageMode('/admin/erp'),'sandbox');
 for(const path of ['/admin/erp-unsafe','/admin/workflows','/admin/safety','/admin/unknown'])assert.equal(isAdminPageAvailable(path),false);
});
test('static internal links resolve to a declared route or deployed static page',()=>{
 const paths=inventory.routes.filter(r=>!r.path.includes('*')).map(r=>r.path);
 const missing=[];
 for(const route of inventory.routes)for(const link of route.links){
  const path=link.split(/[?#]/)[0];
  if(!paths.some(p=>matchPath(p,path))&&!inventory.staticPages.some(p=>p.path===path)&&!/^\/[^?]+\.[a-z]+$/.test(path))missing.push({from:route.path,to:link});
 }
 assert.deepEqual(missing,[]);
});

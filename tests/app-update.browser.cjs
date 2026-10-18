const { chromium } = require('playwright');
const fs=require('fs'), http=require('http'), path=require('path'), assert=require('node:assert/strict');
(async()=>{
 const dir=path.resolve(__dirname, '../dist');
 let old=true, nextRelease=false;
 const oldWorker=fs.readFileSync(__dirname+'/fixtures/sgp-app-v2.js');
 const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.html':'text/html','.svg':'image/svg+xml','.woff2':'font/woff2'};
 const server=http.createServer((req,res)=>{
   const pathname=new URL(req.url,'http://localhost').pathname;
   res.setHeader('Cache-Control','no-store');
   if(pathname==='/sw.js'&&old){res.setHeader('Content-Type','text/javascript');res.end(oldWorker);return;}
   if(pathname==='/app'&&old){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><h1>이전 민트 디자인</h1><script>navigator.serviceWorker.register("/sw.js")</script>');return;}
   if(pathname==='/app-version.json'&&nextRelease){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({release:'next-deployment'}));return;}
   let f=path.join(dir,pathname);
   if(fs.existsSync(f+'.html'))f+='.html';
   if(!fs.existsSync(f)||!fs.statSync(f).isFile())f=dir+'/index.html';
   res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
 });
 await new Promise(resolve=>server.listen(5184,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const context=await browser.newContext();const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5184/app');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
  await page.evaluate(async()=>{localStorage.setItem('auth-preservation-test','keep');const c=await caches.open('unrelated-cache');await c.put('/unrelated',new Response('keep'));});
  old=false;
  assert.match(await page.content(),/이전 민트 디자인/); // Deployment alone cannot replace a running app.
  await page.goto('http://127.0.0.1:5184/app-update');
  await page.getByRole('button',{name:'최신 앱 불러오기'}).click();
  await page.getByRole('link',{name:/로그인하고 시작하기/}).waitFor();
  assert.match(page.url(),/\/app\?release=/);
  const storage=await page.evaluate(async()=>({marker:localStorage.getItem('auth-preservation-test'),keys:await caches.keys(),assets:await (await caches.open('sgp-public-install-v4')).keys().then(keys=>keys.map(x=>new URL(x.url).pathname).sort())}));
  assert.equal(storage.marker,'keep');assert.ok(storage.keys.includes('unrelated-cache'));assert.ok(!storage.keys.includes('sgp-app-v2'));
  assert.deepEqual(storage.assets,['/doelv/icon-192.png','/doelv/icon-512.png','/offline.html']);
  await page.getByRole('link',{name:/로그인하고 시작하기/}).click();
  const phone=page.locator('input[type="tel"]').first();await phone.fill('01000000000');
  nextRelease=true;
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await page.getByText('새 버전이 있습니다.',{exact:false}).waitFor();
  assert.equal(await phone.inputValue(),'010-0000-0000');assert.ok(page.url().includes('/app/login'));
  await page.goto('http://127.0.0.1:5184/app-update?returnTo=https://untrusted.test');
  assert.equal(await page.getByRole('link',{name:'앱으로 돌아가기'}).getAttribute('href'),'/app');
  await context.setOffline(true);
  await page.getByRole('button',{name:'최신 앱 불러오기'}).click();
  await page.getByText(/업데이트하지 못했습니다/).waitFor();
  assert.equal(await page.getByRole('button',{name:'최신 앱 불러오기'}).isEnabled(),true);
  await context.setOffline(false);
  await page.goto('http://127.0.0.1:5184/app');await context.setOffline(true);await page.reload();
  assert.match(await page.content(),/연결/);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({legacyMigration:true,localStoragePreserved:true,unrelatedCachePreserved:true,publicCacheOnly:true,updateNoticeWithoutFormLoss:true,openRedirectRejected:true,offlineRetry:true,offlineFallback:true,jsErrors:errors}));
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});

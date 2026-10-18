/* Local production build only; inquiry requests are intercepted, never sent to production. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../dist');
const output = process.env.CORPORATE_QA_OUTPUT;
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webp':'image/webp', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
(async () => {
  if (output) fs.mkdirSync(output, {recursive:true});
  const server = http.createServer((req,res) => {
    let file = path.join(root,new URL(req.url,'http://localhost').pathname);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root,'index.html');
    res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(5188,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:5188';
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const context=await browser.newContext({serviceWorkers:'block'});
    const requests=[],errors=[];let failure=false;
    await context.route('**/*.supabase.co/**',async route=>{
      const req=route.request();
      if(req.method()==='POST') {
        assert.match(req.url(),/\/rest\/v1\/inquiries$/);requests.push(req.postDataJSON());
        assert.equal(req.headers().authorization,'Bearer '+req.headers().apikey,'public inquiry must not reuse a user token');
        await route.fulfill({status:failure?403:201,contentType:'application/json',body:failure?JSON.stringify({message:'local rejected fixture'}):''});
      } else await route.fulfill({status:200,contentType:'application/json',body:'[]'});
    });
    if(process.env.BRAND_QA_FONT_ROOT){
      const fontRoot=process.env.BRAND_QA_FONT_ROOT;
      const css=fs.readFileSync(path.join(fontRoot,'400.css'),'utf8').replaceAll('./files/','/__qa_fonts/');
      await context.route('**/__qa_fonts/*',r=>r.fulfill({path:path.join(fontRoot,'files',new URL(r.request().url()).pathname.split('/').pop())}));
      await context.addInitScript(css=>document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=css;document.head.appendChild(s)}),css);
    }
    const matrix=[];
    for(const width of [320,390,768,1440,1920]){
      const page=await context.newPage();await page.setViewportSize({width,height:1000});page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin);await page.locator('.dc-hero h1').waitFor();
      for(const img of await page.locator('.dc-photo > img').all()) {await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());}
      for(const logo of await page.locator('.doelv-approved img').all()) await logo.evaluate(el=>el.decode());
      await page.evaluate(()=>document.fonts.ready);
      const observed=await page.evaluate(()=>({images:[...document.querySelectorAll('.dc-photo > img')].length,broken:[...document.images].filter(i=>!i.naturalWidth).length,overflow:document.documentElement.scrollWidth>innerWidth,logo:document.querySelector('.dc-header .doelv-wordmark strong').textContent,oldBrand:/PALATRIA|팔라트리아/.test(document.body.innerText)}));
      assert.equal(observed.images,9);assert.equal(observed.broken,0);assert.equal(observed.overflow,false);assert.equal(observed.logo,'DOELV');assert.equal(observed.oldBrand,false);
      assert.equal(await page.locator('h1').count(),1);
      if(width<901){await page.getByRole('button',{name:'메뉴 열기'}).click();await page.getByRole('navigation',{name:'메인 메뉴'}).getByRole('link',{name:'컬렉션',exact:true}).click();assert.equal(await page.getByRole('button',{name:'메뉴 열기'}).getAttribute('aria-expanded'),'false');}
      await page.evaluate(()=>window.scrollTo(0,0));
      if(output&&[390,1440].includes(width)){
        await page.screenshot({path:path.join(output,`home-${width}.png`),fullPage:true});
        await page.screenshot({path:path.join(output,`hero-${width}.png`)});
      }
      matrix.push({width,...observed});await page.close();
    }
    const page=await context.newPage();await page.setViewportSize({width:1440,height:1000});page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
    for(const [input, expected] of [['100','120–145'],['500','600–725'],['','1~10,000'],['0','1~10,000']]){await page.locator('#capacity-count').fill(input);assert.ok((await page.locator('.dc-capacity-output').textContent()).includes(expected));}
    await page.locator('#capacity-count').fill('100');
    assert.match(await page.locator('.dc-efficiency-note').textContent(),/검증된 현장 실적이나 성능 보증 수치가 아닙니다/);
    await page.getByRole('link',{name:'도엘브 빌리지 프로젝트 상담'}).click();assert.equal(await page.locator('[name=interest]').inputValue(),'도엘브 빌리지');
    await page.getByRole('button',{name:'상담 문의 보내기'}).click();assert.equal(requests.length,0,'invalid form must not send');
    for(const [name,value] of Object.entries({company:'검증 단지',name:'화면 검증',phone:'010-0000-0000',email:'qa@example.invalid',message:'로컬 폼 검증: 실제 문의 아님'}))await page.locator(`[name=${name}]`).fill(value);
    await page.locator('[name=projectType]').selectOption('mixed');await page.locator('[name=consent]').check();
    failure=true;await page.getByRole('button',{name:'상담 문의 보내기'}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('[name=message]').inputValue(),'로컬 폼 검증: 실제 문의 아님');
    failure=false;await page.getByRole('button',{name:'상담 문의 보내기'}).click();await page.getByRole('status').waitFor();assert.equal(requests.length,2);assert.match(requests[1].message,/도엘브 빌리지/);assert.equal(requests[1].project_type,'mixed');
    await page.getByRole('tab',{name:'01 도착과 인계'}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'02 인증과 안전 확인'}).getAttribute('aria-selected'),'true');
    assert.match(await page.getByRole('tabpanel').textContent(),/안전 상태/);
    assert.equal(await page.locator('.dc-app-link').getAttribute('href'),'/app');assert.equal(await page.locator('.dc-platform-links a').nth(1).getAttribute('href'),'/admin');
    await page.goto(origin+'/brand-guide');await page.getByRole('heading',{level:1}).waitFor();assert.match(await page.title(),/브랜드 가이드/);assert.equal(await page.locator('.dc-brand-display .doelv-approved').count(),1);
    await page.goto(origin+'/valet');await page.waitForURL(origin+'/#valet');await page.locator('#valet').waitFor();
    // Simulate a CDN returning HTML for image assets. JPEG should recover every scene.
    await context.route('**/assets/*.webp',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html>missing'}));
    await page.goto(origin);
    for(const photo of await page.locator('.dc-photo').all()){await photo.scrollIntoViewIfNeeded();await photo.locator('img[src$=".jpg"]').waitFor();await photo.locator(':scope > img').evaluate(el=>el.decode());}
    await context.route('**/assets/*.jpg',r=>r.abort());await page.goto(origin);await page.locator('.dc-hero').getByRole('button',{name:'이미지 다시 불러오기 ↻'}).waitFor();
    assert.equal(await page.locator('.dc-header .doelv-approved').count(),1);
    await context.unroute('**/assets/*.webp');await context.unroute('**/assets/*.jpg');
    await page.locator('.dc-hero').getByRole('button',{name:'이미지 다시 불러오기 ↻'}).click();await page.locator('.dc-hero .dc-photo > img').evaluate(el=>el.decode());
    await page.goto(origin+'/app');await page.locator('.doelv-photo').waitFor();assert.equal(await page.locator('.dc-shell').count(),0);
    assert.deepEqual(errors,[]);
    const result={matrix,formValidation:true,formRejectedRetainsData:true,formSuccessAfterAcceptedResponse:true,localInterceptedSubmissions:requests.length,jpegFallback:9,manualRetry:true,keyboardTabs:true,legacyValetRedirect:true,brandGuide:true,appLink:'/app',adminLink:'/admin',jsErrors:errors,productionWrites:0};
    if(output)fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});

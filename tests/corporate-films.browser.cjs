/* Production build + local public-media fixtures. No backend writes or real login. */
const { chromium }=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),output=process.env.MOTION_QA_OUTPUT;
const media=process.env.MOTION_QA_VIDEO;
assert.ok(media&&fs.existsSync(media),'Set MOTION_QA_VIDEO to a local playable MP4 fixture');
const files=['1779601569837_66flwrlm8mo.mp4','1779140483488_lsschk76kn.mp4','1779582138626_075931nq0kj6.mp4'];
const base='https://ykmeconwqbathcdejalr.supabase.co/storage/v1/object/public/section-media/videos/';
const rows=[{id:'local',sort_order:0,items:files.map(f=>({url:base+f,alt:''})).concat([{url:'javascript:alert(1)'},{url:'https://example.invalid/x.html'},{url:base+files[0]}])}];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
(async()=>{
  if(output)fs.mkdirSync(output,{recursive:true});
  const server=http.createServer((req,res)=>{let file=path.join(root,new URL(req.url,'http://localhost').pathname);if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
  await new Promise(resolve=>server.listen(5189,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const context=await browser.newContext({serviceWorkers:'block'}),errors=[],mutations=[];let listError=false,videoError=false,empty=false,videoRequests=0;
    await context.route('**/*.supabase.co/**',async route=>{
      const req=route.request(),url=new URL(req.url());if(!['GET','HEAD'].includes(req.method()))mutations.push(req.method()+' '+url.pathname);
      if(url.pathname.includes('/rest/v1/section_media')){
        assert.equal(url.searchParams.get('active'),'eq.true');assert.equal(url.searchParams.get('media_type'),'eq.video');
        return route.fulfill({status:listError?503:200,contentType:'application/json',body:JSON.stringify(listError?{message:'local unavailable'}:empty?[]:rows)});
      }
      if(url.pathname.endsWith('.mp4')){videoRequests++;if(videoError)return route.abort();return route.fulfill({status:200,contentType:'video/mp4',path:media});}
      return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    });
    if(process.env.BRAND_QA_FONT_ROOT){const fontRoot=process.env.BRAND_QA_FONT_ROOT,css=fs.readFileSync(path.join(fontRoot,'400.css'),'utf8').replaceAll('./files/','/__qa_fonts/');await context.route('**/__qa_fonts/*',r=>r.fulfill({path:path.join(fontRoot,'files',new URL(r.request().url()).pathname.split('/').pop())}));await context.addInitScript(css=>document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=css;document.head.appendChild(s)}),css);}
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const matrix=[];
    for(const width of [320,390,768,1024,1440]){
      await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:5189/');await page.locator('.dc-film-card').nth(2).waitFor();
      assert.equal(await page.locator('.dc-film-card').count(),3,'unsafe and duplicate URLs excluded');assert.equal(await page.locator('video').count(),0,'no media loading before intent');assert.equal(videoRequests,0);
      await page.locator('#films').scrollIntoViewIfNeeded();for(const img of await page.locator('#films img').all())await img.evaluate(i=>i.decode());
      const observed=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,broken:[...document.querySelectorAll('#films img')].filter(i=>!i.naturalWidth).length}));assert.equal(observed.overflow,false);assert.equal(observed.broken,0);
      matrix.push({width,...observed});if(output&&[390,1440].includes(width)){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,`films-${width}.png`)});}
    }
    await page.locator('.dc-film-start').click();await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.2);
    assert.equal(await page.locator('video').evaluate(v=>v.controls&&v.playsInline),true);assert.ok(await page.locator('video').evaluate(v=>v.videoWidth>0&&Number.isFinite(v.duration)));
    const oldVideo=await page.locator('video').elementHandle();await page.locator('.dc-film-card').nth(1).click();assert.equal(await oldVideo.evaluate(v=>v.isConnected),false);assert.equal(await page.locator('video').count(),0);assert.match(await page.locator('.dc-film-caption h3').textContent(),/내 공간/);
    await page.locator('.dc-film-start').click();await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.2);assert.match(await page.locator('video').getAttribute('src'),/1779140483488/);
    await page.locator('.dc-film-card').nth(2).click();videoError=true;await page.locator('.dc-film-start').click();await page.getByRole('button',{name:'영상 다시 불러오기',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'원본 영상 열기 ↗'}).getAttribute('href'),base+files[2]);
    videoError=false;await page.getByRole('button',{name:'영상 다시 불러오기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.2);
    listError=true;await page.reload();await page.getByRole('button',{name:'영상 목록 다시 불러오기'}).waitFor();listError=false;await page.getByRole('button',{name:'영상 목록 다시 불러오기'}).click();await page.locator('.dc-film-card').nth(2).waitFor();
    empty=true;await page.reload();await page.getByText('공개된 영상이 아직 없습니다.',{exact:true}).waitFor();assert.equal(await page.locator('.dc-film-card').count(),0,'withdrawn media must not remain in a fallback catalog');
    assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
    const result={matrix,actualMp4Playback:true,controls:true,playsInline:true,zeroInitialVideoDownloads:true,switchUnmountsPreviousPlayer:true,mediaErrorRecovery:true,listErrorRecovery:true,emptyCatalog:true,unsafeAndDuplicateUrlsFiltered:true,jsErrors:errors,backendMutations:mutations};
    if(output)fs.writeFileSync(path.join(output,'films-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

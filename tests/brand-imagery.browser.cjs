/* Built production assets, local server + intercepted resident fixtures only. No real login or backend writes. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../dist');
const output = process.env.BRAND_QA_OUTPUT;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const scenes = ['home', 'call', 'garage', 'access', 'profile', 'requests', 'wallet'];
const routeFor = scene => '/app' + (scene === 'home' ? '' : '/' + scene);
(async () => {
  if (output) fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    let file = path.join(root, pathname);
    if (fs.existsSync(file + '.html')) file += '.html';
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(5186, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:5186';
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const errors = [], mutations = [], matrix = [];
    const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'visual-qa@example.invalid' };
    await context.route('**/*.supabase.co/**', async route => {
      const req = route.request(), pathname = new URL(req.url()).pathname;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) mutations.push(pathname);
      let data = [];
      if (pathname.startsWith('/auth/v1/')) data = pathname.endsWith('/user') ? user : { user };
      if (pathname.includes('/sgp_users')) data = { id: user.id, phone: '01000000000', display_name: '화면 검증', status: 'active', is_verified: true };
      if (pathname.includes('/user_roles')) data = null;
      if (pathname.includes('/sgp_coin_wallets')) data = { user_id: user.id, balance: 0 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    if (process.env.BRAND_QA_FONT_ROOT) {
      const fontRoot = process.env.BRAND_QA_FONT_ROOT;
      const css = fs.readFileSync(path.join(fontRoot, '400.css'), 'utf8').replaceAll('./files/', '/__qa_fonts/') + '\nbody,.doelv-shell,.doelv-shell p,.doelv-shell a,.doelv-shell button,.MuiTypography-root,.MuiInputBase-root{font-family:"Noto Sans KR",sans-serif!important}';
      await context.route('**/__qa_fonts/*', r => r.fulfill({ path: path.join(fontRoot, 'files', new URL(r.request().url()).pathname.split('/').pop()) }));
      await context.addInitScript(css => document.addEventListener('DOMContentLoaded', () => { const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style); }), css);
    }
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/app');
    await page.locator('.doelv-photo.is-loaded').waitFor();
    assert.equal(await page.locator('svg.doelv-mark').count(), 1);
    const jwt = ['e30', Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url'), 'local-fixture'].join('.');
    await page.evaluate(({ jwt, user }) => localStorage.setItem('sb-ykmeconwqbathcdejalr-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'local-fixture', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user })), { jwt, user });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      for (const scene of scenes) {
        await page.goto(origin + routeFor(scene));
        await page.locator(`.doelv-photo[data-scene="${scene}"].is-loaded`).waitFor();
        await page.locator('.doelv-photo-image').evaluate(img => img.decode());
        const observed = await page.evaluate(() => {
          const img = document.querySelector('.doelv-photo-image'), rect = img.getBoundingClientRect();
          return { src: img.currentSrc, width: rect.width, height: rect.height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
            opacity: getComputedStyle(img).opacity, overflow: document.documentElement.scrollWidth > innerWidth, logo: document.querySelector('svg.doelv-mark')?.getBoundingClientRect().width,
            wordmark: document.querySelector('.doelv-wordmark strong')?.textContent, broken: [...document.images].filter(i => i.complete && !i.naturalWidth).length };
        });
        assert.match(observed.src, new RegExp('/assets/' + scene + '-(?:800|full)-[\\w-]+\\.webp$'));
        assert.equal(observed.opacity, '1'); assert.ok(observed.logo >= 48); assert.equal(observed.wordmark, 'DOELV'); assert.equal(observed.broken, 0); assert.equal(observed.overflow, false);
        assert.ok(Math.abs(observed.width / observed.height - observed.naturalWidth / observed.naturalHeight) < .02, 'no stretching/cropping');
        matrix.push({ scene, width, loaded: true, logo: 'inline-svg', broken: 0 });
        if (output && [390, 1440].includes(width)) { await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }); await page.screenshot({ path: path.join(output, `${scene}-${width}.png`), fullPage: true }); }
      }
    }
    // SPA transitions exercise scene-state replacement without document reloads.
    for (const [label, scene] of [['홈', 'home'], ['차량 호출', 'call'], ['게러지', 'garage'], ['출입', 'access'], ['설정', 'profile']]) {
      await page.getByRole('navigation', { name: '앱 주요 메뉴' }).getByRole('link', { name: label, exact: true }).click();
      await page.locator(`.doelv-photo[data-scene="${scene}"].is-loaded`).waitFor();
    }
    for (const [alias, scene] of [['parking', 'garage'], ['map', 'garage'], ['spots', 'garage'], ['pay', 'wallet']]) {
      await page.goto(origin + '/app/' + alias);
      await page.locator(`.doelv-photo[data-scene="${scene}"].is-loaded`).waitFor();
    }
    // Corrupt/HTML WebP responses must decode-fail and select an independently served JPEG.
    await context.route('**/assets/*.webp', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>missing image' }));
    for (const scene of scenes) {
      await page.goto(origin + routeFor(scene));
      await page.locator('.doelv-photo.is-loaded').waitFor();
      await page.locator('.doelv-photo-image').evaluate(img => img.decode());
      assert.match(await page.locator('.doelv-photo-image').getAttribute('src'), /\.jpg$/);
    }
    await context.route('**/assets/*.jpg', r => r.abort());
    await page.goto(origin + '/app/call');
    await page.getByRole('button', { name: '사진 다시 불러오기' }).waitFor();
    assert.equal(await page.locator('svg.doelv-mark').count(), 1);
    assert.equal(await page.locator('.doelv-photo-image').count(), 0);
    assert.equal(await page.getByRole('button', { name: '설비 연동 후 호출 가능' }).isDisabled(), true);
    // A failure on one route must not poison the next route's new image state.
    await context.unroute('**/assets/*.webp'); await context.unroute('**/assets/*.jpg');
    await page.getByRole('button', { name: '사진 다시 불러오기' }).click();
    await page.locator('.doelv-photo.is-loaded').waitFor();
    assert.match(await page.locator('.doelv-photo-image').getAttribute('src'), /\?retry=\d+$/);
    await page.getByRole('navigation', { name: '앱 주요 메뉴' }).getByRole('link', { name: '게러지', exact: true }).click();
    await page.locator('.doelv-photo[data-scene="garage"].is-loaded').waitFor();
    assert.deepEqual(errors, []); assert.deepEqual(mutations, []);
    const result = { matrix, spaNavigation: true, aliases: 4, jpegRecovery: 7, brokenPlaceholderAvoided: true, manualRetry: true, noBackendMutations: true, jsErrors: errors, boundary: 'Production build tested locally with isolated authenticated fixtures; no production user login.' };
    if (output) fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

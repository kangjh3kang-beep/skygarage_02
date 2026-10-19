import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageGuides, guideMode, resolvePageGuide } from '../src/lib/page-guides.ts';
import { onboardingAcceptance, parseDeploymentRelease } from '../src/lib/onboarding.ts';

const inventory = JSON.parse(readFileSync(new URL('../src/lib/page-inventory.json', import.meta.url), 'utf8'));
test('each declared route has an exact guide with the same availability', () => {
  assert.equal(new Set(pageGuides.map(g => g.path)).size, pageGuides.length);
  for (const route of inventory.routes) {
    const guide = pageGuides.find(g => g.path === route.path);
    assert.ok(guide, route.path);
    assert.equal(guideMode(route.path), route.mode, route.path);
    for (const key of ['title', 'purpose', 'expected']) assert.ok(guide[key].length > 3, `${route.path} ${key}`);
    for (const key of ['setup', 'steps', 'problems', 'related']) assert.ok(guide[key].length, `${route.path} ${key}`);
  }
});
test('guide shortcuts target declared concrete routes; static recovery pages include instructions', () => {
  const known = new Set(inventory.routes.map(r => r.path));
  for (const guide of pageGuides) for (const link of guide.related) {
    assert.ok(known.has(link.path), `${guide.path} -> ${link.path}`);
    assert.doesNotMatch(link.path, /[:*]/);
  }
  for (const path of ['offline', 'app-update']) {
    assert.ok(pageGuides.some(g => g.path === '/' + path));
    const html = readFileSync(new URL(`../public/${path}.html`, import.meta.url), 'utf8');
    assert.match(html, /설정·사용 안내/);
    assert.match(html, /href="\/help"/);
  }
});
test('guide resolution handles dynamic IDs, trailing slashes and unknown routes without opening features', () => {
  assert.equal(resolvePageGuide('/admin/inquiries/abc/?from=list#reply').path, '/admin/inquiries/:id');
  assert.equal(resolvePageGuide('/tracking/track/test-vehicle').path, '/tracking/track/:vehicleId');
  assert.equal(resolvePageGuide('/admin/erp/?from=start').path, '/admin/erp');
  assert.equal(resolvePageGuide('/admin/erp/unknown').path, '/admin/*');
  assert.equal(resolvePageGuide('/unknown').path, '/*');
  assert.equal(resolvePageGuide('/app/unknown').path, '/app/*');
  assert.equal(guideMode('/admin/workflows'), 'commissioning');
});
test('deployment identity fails closed and G0 procedures do not claim executed results', () => {
  const sha = 'b0219e0eca6a0bc3f6bb7dee61da0f5629d074a3';
  assert.equal(parseDeploymentRelease({ release: sha }), sha);
  for (const value of [null, {}, { release: 'local-build' }, { commit: sha }, { release: sha.slice(0, 7) }, { release: '<script>' }]) assert.throws(() => parseDeploymentRelease(value));
  assert.equal(onboardingAcceptance.length, 6);
  assert.equal(new Set(onboardingAcceptance.map(c => c.id)).size, 6);
  for (const c of onboardingAcceptance) {
    assert.ok(['F01', 'F06'].includes(c.requirement));
    assert.ok(c.steps.length >= 2);
    assert.equal('passed' in c || 'actual_result' in c, false);
  }
});

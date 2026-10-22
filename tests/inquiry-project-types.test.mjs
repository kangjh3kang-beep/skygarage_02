import test from 'node:test';
import assert from 'node:assert/strict';
import { projectTypeLabels, getProjectTypeLabel } from '../src/lib/types.ts';

// --- Legacy labels preserved ---
test('legacy labels (website, app, ecommerce, branding, consulting, other) are preserved', () => {
  const legacy = { website: '웹사이트', app: '앱 개발', ecommerce: '이커머스', branding: '브랜딩', consulting: '컨설팅', other: '기타' };
  for (const [key, expected] of Object.entries(legacy)) {
    assert.equal(projectTypeLabels[key], expected, `legacy key "${key}" must map to "${expected}"`);
  }
});

// --- Public form types have labels ---
// CorporateInquiry.tsx uses: mixed, apartment, officetel, retrofit, investment, government, other
// ContactSection.tsx also uses: industrial
test('CorporateInquiry form types have Korean labels', () => {
  const corporateTypes = ['mixed', 'apartment', 'officetel', 'retrofit', 'investment', 'government', 'other'];
  for (const key of corporateTypes) {
    assert.equal(typeof projectTypeLabels[key], 'string', `"${key}" from CorporateInquiry must have a label`);
    assert.ok(projectTypeLabels[key].length > 0, `"${key}" label must not be empty`);
  }
});

test('ContactSection form types have Korean labels', () => {
  const contactTypes = ['apartment', 'officetel', 'mixed', 'industrial', 'retrofit', 'investment', 'government', 'other'];
  for (const key of contactTypes) {
    assert.equal(typeof projectTypeLabels[key], 'string', `"${key}" from ContactSection must have a label`);
    assert.ok(projectTypeLabels[key].length > 0, `"${key}" label must not be empty`);
  }
});

// --- Helper function ---
test('getProjectTypeLabel returns label for known types', () => {
  assert.equal(getProjectTypeLabel('apartment'), projectTypeLabels['apartment']);
  assert.equal(getProjectTypeLabel('website'), '웹사이트');
  assert.equal(getProjectTypeLabel('mixed'), projectTypeLabels['mixed']);
});

test('getProjectTypeLabel returns raw value for unknown types instead of undefined', () => {
  assert.equal(getProjectTypeLabel('some_future_type'), 'some_future_type');
  assert.equal(getProjectTypeLabel(''), '');
  assert.equal(getProjectTypeLabel('지식산업'), '지식산업');
});

test('unknown Object prototype names remain strings rather than inherited properties', () => {
  for (const key of ['constructor', 'toString', '__proto__']) {
    assert.equal(getProjectTypeLabel(key), key);
  }
});

// --- Both admin pages must use the same helper ---
// This is a structural check: InquiryDetail must not produce undefined for any form value
test('no form project_type value produces undefined through the helper', () => {
  const allFormValues = ['mixed', 'apartment', 'officetel', 'retrofit', 'investment', 'government', 'industrial', 'other',
    'website', 'app', 'ecommerce', 'branding', 'consulting'];
  for (const v of allFormValues) {
    const result = getProjectTypeLabel(v);
    assert.notEqual(result, undefined, `getProjectTypeLabel("${v}") must not return undefined`);
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { previewSiteTemplate, validateSiteTemplate } from '../src/lib/site-template.ts';
import { appUrl, domainDestination } from '../src/lib/domain-routing.ts';
const input={name:'검증 단지',kind:'apartment',households:200,parkingSpaces:240};
test('generated configuration is sandbox-only and never copies authority or PII',()=>{
 const result=previewSiteTemplate({...input,hardware_control_enabled:true,role:'super_admin',secret:'DO NOT COPY'});
 assert.equal(result.hardware_control_enabled,false);assert.equal(result.phase,'sandbox');assert.equal(result.payments_enabled,false);
 assert.equal(result.secret,undefined);assert.equal(result.role,undefined);assert.equal(result.members,undefined);
});
test('invalid type, missing name, capacity boundaries and fractions rejected',()=>{
 for(const patch of [{name:''},{kind:'unknown'},{households:0},{households:10001},{households:1.5},{parkingSpaces:-1},{parkingSpaces:20001}]) assert.ok(validateSiteTemplate({...input,...patch}).length);
 assert.deepEqual(validateSiteTemplate({...input,households:1,parkingSpaces:0}),[]);
});
test('marketing remains available while official-domain switch is unverified',()=>{
 assert.equal(appUrl(undefined),'/app');assert.equal(appUrl('https://evil.test'),'/app');assert.equal(appUrl('https://skygarage.app'),'https://skygarage.app/app');
 assert.equal(domainDestination('www.skygarage.net','/'),null);
 assert.equal(domainDestination('skygarage.app','/'),'/app');
 assert.equal(domainDestination('skygarage.app','/app/profile'),null);
 assert.equal(domainDestination('skygarage.app','/admin/templates'),'https://www.skygarage.net/admin');
});

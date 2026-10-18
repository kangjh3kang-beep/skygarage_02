import test from 'node:test';
import assert from 'node:assert/strict';
import { registerResident } from '../supabase/functions/sms-verify/signup.ts';

const body = {phone:'01000000000',password:'test-only-password',display_name:'가입검증',birth_date:'900101',gender_code:'1',address:'테스트 주소',address_detail:'',verification_id:'11111111-1111-4111-8111-111111111111',code:'123456'};
function mock(options = {}) {
  const calls = [];
  return {calls, rpc: async (name, args) => {
    calls.push([name,args]);
    return name === 'sgp_claim_signup'
      ? {data: options.invalidProof ? {error:'invalid'} : {phone:body.phone,verified_at:new Date().toISOString()},error:options.proofError || null}
      : {error:options.profileError || null};
  }, auth:{admin:{
    createUser:async args=>{calls.push(['createUser',args]);return {data:{user:options.authError ? null : {id:'new-test-user'}},error:options.authError || null};},
    deleteUser:async id=>{calls.push(['deleteUser',id]);return {error:options.cleanupError || null};},
  }}};
}
test('invalid/missing SMS proof fields never access admin APIs', async()=>{
  for(const input of [null,{}, {...body,verification_id:''},{...body,code:'a12345'},{...body,password:'123'},{...body,address:''}]) {
    const client=mock(); assert.equal((await registerResident(client,input)).status,400);assert.equal(client.calls.length,0);
  }
});
test('expired/replayed proof cannot create a user',async()=>{
  const client=mock({invalidProof:true});const result=await registerResident(client,body);
  assert.equal(result.status,403);assert.equal(result.body.code,'verification_required');assert.deepEqual(client.calls.map(c=>c[0]),['sgp_claim_signup']);
});
test('DB failure never bypasses SMS authentication',async()=>{
  const client=mock({proofError:{message:'private database error'}});const result=await registerResident(client,body);
  assert.equal(result.status,503);assert.equal(client.calls.length,1);assert.ok(!JSON.stringify(result).includes('private'));
});
test('verified signup creates user then atomic profile/wallet, no session secrets returned',async()=>{
  const client=mock();assert.deepEqual(await registerResident(client,body),{status:201,body:{registered:true}});
  assert.deepEqual(client.calls.map(c=>c[0]),['sgp_claim_signup','createUser','sgp_finish_signup']);
  assert.equal(client.calls[1][1].email_confirm,true);assert.equal(client.calls[2][1].p_user_id,'new-test-user');
});
test('existing account is not changed or removed',async()=>{
  const client=mock({authError:{code:'email_exists',message:'secret'}});const result=await registerResident(client,body);
  assert.equal(result.status,409);assert.equal(result.body.code,'already_registered');assert.equal(client.calls.length,2);
});
test('profile failure compensates only newly created auth account',async()=>{
  const client=mock({profileError:{message:'private'}});const result=await registerResident(client,body);
  assert.equal(result.body.code,'verification_required');assert.deepEqual(client.calls.at(-1),['deleteUser','new-test-user']);
});
test('cleanup failure is not misreported as a clean retry',async()=>{
  const client=mock({profileError:{},cleanupError:{}});assert.equal((await registerResident(client,body)).body.code,'registration_incomplete');
});

 test('client cannot select unconfigured PASS or self-assert identity assurance',async()=>{
  for(const method of ['pass','unknown']){
    const client=mock();const result=await registerResident(client,{...body,verification_method:method,verified:true,kyc_level:2});
    assert.equal(result.status,method==='pass'?501:400);assert.equal(client.calls.length,0);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { trustedAdminRole, adminLoginIdentifier } from '../src/lib/admin-role.ts';
import { commissioningResponse } from '../supabase/functions/_shared/commissioning.ts';
test('missing/error/unrecognized roles cannot create administrator authority',()=>{
 for(const row of [null,{}, {role:'owner'},{role:'super_admin',user_metadata:{role:'super_admin'}}]) {
  if(row?.role==='super_admin') assert.equal(trustedAdminRole(row,{message:'permission denied'}),null);
  else assert.equal(trustedAdminRole(row,null),null);
 }
 assert.equal(trustedAdminRole({role:'super_admin'},null),'super_admin');
});
test('phone admin login uses the existing account, email stays intact',()=>{
 assert.equal(adminLoginIdentifier('010-0000-0000'),'01000000000@sgp.skygarage.app');
 assert.equal(adminLoginIdentifier(' user@example.com '),'user@example.com');
});
test('all legacy command and account mutations fail closed, including forged approvals',async()=>{
 for(const name of ['hardware-gateway','safety-gate','workflow-engine','heartbeat-monitor','priority-dispatch','vehicle-simulator','user-management','ai-agent']){
  for(const method of ['GET','POST','PUT','DELETE']){
   const response=commissioningResponse(new Request(`https://example.test/${name}/dispatch-command?approved=true`,{method,...(method==='GET'?{}:{body:JSON.stringify({approver_id:'admin',safe:true,command:'door_open'})})}));
   assert.equal(response.status,503);assert.equal((await response.json()).hardware_control_enabled,false);
  }
 }
});
test('health cannot be mistaken for operational readiness',async()=>{
 const result=commissioningResponse(new Request('https://example.test/hardware-gateway/health'));
 assert.deepEqual(await result.json(),{mode:'commissioning',operational:false,hardware_control_enabled:false});
 assert.equal(commissioningResponse(new Request('https://example.test/safety-gate/health',{method:'POST'})).status,503);
});

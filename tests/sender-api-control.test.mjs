import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveSenderRequest,pauseSender,recordSenderRateLimit} from '../functions/lib/sender-api-control.mjs';
import {syncPartner} from '../functions/lib/cleaning-sender-sync.mjs';
import {deliverOnce} from '../functions/lib/partner-email-delivery.mjs';
import {deliveryFixture} from './partner-email-fixture.mjs';
test('shared provider pause prevents both subscriber and email calls',async()=>{
 const {db,binding}=deliveryFixture();const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('must not call provider');};
 try{
  await pauseSender(binding,600);
  await assert.rejects(()=>syncPartner({EMAIL_DELIVERY_DB:binding,SENDER_API_TOKEN:'test'},{email:'company@example.test'}),e=>e.status===429);
  const result=await deliverOnce(binding,'event-123','a@example.test',async()=>{calls++;return {state:'sent'};});
  assert.equal(result.status,503);assert.equal(calls,0);
  assert.equal(db.prepare('SELECT count(*) n FROM email_delivery').get().n,0);
 }finally{globalThis.fetch=original;db.close();}
});
test('a request reserves shared pacing slot and a longer cooldown is never shortened',async()=>{
 const {db,binding}=deliveryFixture();try{
  await reserveSenderRequest(binding);
  assert.ok(db.prepare("SELECT blocked_until FROM provider_cooldown WHERE provider='sender_request_gate'").get().blocked_until>Date.now());
  await pauseSender(binding,600);await pauseSender(binding,60);
  assert.ok(db.prepare("SELECT blocked_until FROM provider_cooldown WHERE provider='sender'").get().blocked_until>Date.now()/1000+500);
 }finally{db.close();}
});

test('provider diagnostics persist counters without response data',async()=>{
 const {db,binding}=deliveryFixture();try{
  const response=new Response('Too many requests secret@example.test',{status:429,headers:{'X-RateLimit-Limit':'60','X-RateLimit-Remaining':'0','Retry-After':'900'}});
  await recordSenderRateLimit(binding,response,'email');
  const rows=db.prepare("SELECT * FROM provider_cooldown").all();
  assert.equal(rows.find(r=>r.provider==='sender_diagnostic_limit').blocked_until,60);
  assert.ok(!JSON.stringify(rows).includes('secret'));assert.equal(await response.text(),'Too many requests secret@example.test');
 }finally{db.close();}
});

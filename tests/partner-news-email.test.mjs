import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPartnerEngagementEmail} from '../functions/lib/partner-engagement-email.mjs';
import {renderPartnerNewsEmail} from '../functions/lib/partner-news-email.mjs';
import {onRequestPost,onRequestGet} from '../functions/api/make/partner-engagement-notification.ts';
import {deliveryFixture} from './partner-email-fixture.mjs';
const payload={event_id:'engagement:commercial_news:v1:partner-id',event_type:'unused_free_contacts',partner_email:'partner@test.pt',partner_name:'Empresa <teste>',dashboard_url:'https://parceiros.guiadoproprietario.pt/?t=private#saldo',data:{kind:'commercial_news_v1',prices:{partilhada:280,exclusiva:500}}};
test('delivered commercial news uses the exact review template and rejects mismatched events',()=>{
 const e=renderPartnerEngagementEmail(payload);
 assert.deepEqual(e,renderPartnerNewsEmail({prices:payload.data.prices,name:payload.partner_name,url:payload.dashboard_url}));
 assert.match(e.text,/2,80 €/);assert.match(e.text,/5,00 €/);assert.match(e.html,/Empresa &lt;teste&gt;/);assert.doesNotMatch(e.text,/pedido.*fechad|por cada quatro/i);
 assert.throws(()=>renderPartnerEngagementEmail({...payload,event_id:'engagement:unused_free_contacts:partner-id'}));
 assert.throws(()=>renderPartnerEngagementEmail({...payload,dashboard_url:'https://external.test/'}));
});
test('unapproved news is suppressed before any Sender request and renderer advertises capability',async()=>{
 const f=deliveryFixture(),original=globalThis.fetch;let senderCalls=0;
 const env={MAKE_PARTNER_NOTIFICATIONS_SECRET:'secret',PARTNER_ENGAGEMENT_ENABLED:'true',SENDER_API_TOKEN:'sender',CLEANING_DASHBOARD_API_TOKEN:'policy',EMAIL_DELIVERY_DB:f.binding};
 try{
  globalThis.fetch=async url=>{if(String(url).includes('api.sender.net'))senderCalls++;return new Response(JSON.stringify({ok:true,allowed:String(url).includes('partner-email-policy')}));};
  const req=new Request('https://test/api',{method:'POST',headers:{Authorization:'Bearer secret','Content-Type':'application/json'},body:JSON.stringify(payload)});
  const res=await onRequestPost({request:req,env});assert.equal(res.status,200);assert.equal((await res.json()).suppressed,true);assert.equal(senderCalls,0);
  const caps=await onRequestGet({request:new Request('https://test/api',{headers:{Authorization:'Bearer secret'}}),env});assert.equal((await caps.json()).commercial_news,1);
 }finally{globalThis.fetch=original;f.db.close();}
});
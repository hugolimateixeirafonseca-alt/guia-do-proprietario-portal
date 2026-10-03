import test from 'node:test';
import assert from 'node:assert/strict';
import {renderClientInterestEmail} from '../functions/lib/partner-engagement-email.mjs';
import {onRequestPost} from '../functions/api/make/partner-engagement-notification.ts';
import {deliveryFixture} from './partner-email-fixture.mjs';
const data={audience:'client',client_name:'Ana',municipality:'Porto',stage:5,interest_url:'https://parceiros.guiadoproprietario.pt/pedido-interesse.html#id=test&expires=1900000000&token=test',stop_url:'https://parceiros.guiadoproprietario.pt/pedido-contactos.html#id=test&expires=1900000000&token=test'};
test('interest copy escapes data and rejects placeholders and unsafe links',()=>{
 const message=renderClientInterestEmail({...data,client_name:'Ana & Maria'});assert.match(message.html,/Ana &amp; Maria/);assert.match(message.text,/ainda pode ser aceite/);assert.equal((message.html.match(/href="https:[^"]*pedido-/g)||[]).length,2);assert.doesNotMatch(message.text,/undefined|null|\{\w+\}/);
 for(const patch of [{municipality:null},{client_name:'{nome}'},{stage:3},{interest_url:'https://evil.invalid/pedido-interesse.html#test'}])assert.throws(()=>renderClientInterestEmail({...data,...patch}));
});
test('client interest uses fresh policy data and idempotent delivery without partner-only lookup',async()=>{
 const f=deliveryFixture(),original=globalThis.fetch,sent=[];let allowed=true;
 const payload={event_id:'engagement:client_interest:5:test',event_type:'client_interest',partner_email:'client@example.invalid',partner_name:'Ana',dashboard_url:'',data};
 const env={PARTNER_ENGAGEMENT_ENABLED:'true',MAKE_PARTNER_NOTIFICATIONS_SECRET:'secret',SENDER_API_TOKEN:'test',CLEANING_DASHBOARD_API_TOKEN:'test',EMAIL_DELIVERY_DB:f.binding};
 globalThis.fetch=async(url,init)=>{if(String(url).endsWith('/api/partner-engagement-policy'))return Response.json({ok:true,allowed,event_type:'client_interest',partner_name:'Ana',dashboard_url:'',data:{...data,municipality:'Gaia'}});assert.equal(String(url),'https://api.sender.net/v2/message/send');sent.push(JSON.parse(init.body));return Response.json({ok:true});};
 const req=()=>new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer secret','Content-Type':'application/json'},body:JSON.stringify(payload)});
 try{for(let i=0;i<2;i++)assert.equal((await onRequestPost({request:req(),env})).status,200);assert.equal(sent.length,1);assert.match(sent[0].text,/Gaia/);allowed=false;assert.equal((await(await onRequestPost({request:req(),env})).json()).suppressed,true);assert.equal(sent.length,1);}finally{globalThis.fetch=original;f.db.close();}
});

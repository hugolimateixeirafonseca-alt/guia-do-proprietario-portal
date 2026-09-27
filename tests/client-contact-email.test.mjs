import test from 'node:test';import assert from 'node:assert/strict';
import {renderClientContactEmail} from '../functions/lib/partner-engagement-email.mjs';
import {onRequestPost} from '../functions/api/make/partner-engagement-notification.ts';
import {deliveryFixture} from './partner-email-fixture.mjs';
const data={audience:'client',client_name:'Ana',professional_name:'Limpezas Norte',professional_phone:'+351912345678',municipality:'Porto',modality:'partilhada',stop_url:'https://parceiros.guiadoproprietario.pt/pedido-contactos.html#id=sample&expires=1800000000&token=example'};
const payload={event_id:'engagement:client_contact_accepted:assignment',event_type:'contact_accepted',partner_email:'client@example.invalid',partner_name:'Ana',dashboard_url:'',data};
const req=()=>new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer secret','Content-Type':'application/json'},body:JSON.stringify(payload)});
test('customer copy covers both modalities, escaped values, one stop link and no private dashboard',()=>{
 for(const mode of ['partilhada','exclusiva']){const m=renderClientContactEmail({...data,modality:mode,professional_name:'Casa & Jardim'});assert.match(m.subject,/Casa & Jardim/);assert.match(m.html,/Casa &amp; Jardim/);assert.equal((m.html.match(/<a /g)||[]).length,1);assert.doesNotMatch(m.text,/\?t=|undefined|null|\{\w+\}/);assert.match(m.text,/próximas 24 horas/);assert.ok(m.text.includes(mode==='partilhada'?'até 3 profissionais':'através do Guia do Proprietário'));}
 for(const patch of [{professional_phone:'bad'},{client_name:'{nome}'},{stop_url:'https://evil.invalid/x'},{professional_name:null}])assert.throws(()=>renderClientContactEmail({...data,...patch}));
});
test('customer delivery rechecks exact event and destination, uses fresh data, and sends once; optout suppresses',async()=>{
 const f=deliveryFixture(),original=globalThis.fetch,sent=[];let allowed=true;
 const env={PARTNER_ENGAGEMENT_ENABLED:'true',MAKE_PARTNER_NOTIFICATIONS_SECRET:'secret',SENDER_API_TOKEN:'test',CLEANING_DASHBOARD_API_TOKEN:'test',EMAIL_DELIVERY_DB:f.binding};
 globalThis.fetch=async(url,init)=>{
  if(String(url).endsWith('/api/partner-engagement-policy')){assert.equal(JSON.parse(init.body).email,'client@example.invalid');return Response.json({ok:true,allowed,event_type:'contact_accepted',partner_name:'Ana',dashboard_url:'',data:{...data,professional_phone:'912999999'}});}
  assert.equal(String(url),'https://api.sender.net/v2/message/send');sent.push(JSON.parse(init.body));return Response.json({ok:true});
 };
 try{for(let i=0;i<2;i++)assert.equal((await onRequestPost({request:req(),env})).status,200);assert.equal(sent.length,1);assert.equal(sent[0].to.email,'client@example.invalid');assert.match(sent[0].text,/912999999/);assert.doesNotMatch(sent[0].text,/dashboard|\?t=/);allowed=false;assert.equal((await(await onRequestPost({request:req(),env})).json()).suppressed,true);assert.equal(sent.length,1);
 assert.equal((await onRequestPost({request:req(),env:{...env,APP_ENV:'preview',PARTNER_ENGAGEMENT_TEST_MODE:'true',PARTNER_ENGAGEMENT_TEST_EMAIL:'other@example.invalid'}})).status,403);
 }finally{globalThis.fetch=original;f.db.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPartnerEngagementEmail} from '../functions/lib/partner-engagement-email.mjs';
import {onRequestPost,onRequestGet} from '../functions/api/make/partner-engagement-notification.ts';
import {deliveryFixture} from './partner-email-fixture.mjs';
const secret='campaign-test-secret';
const data={copyVersion:'v2',workflowKind:'BF-reminder',campaign:{terms_version:'2026-11-27.1',terms:['Primeiro carregamento de exatamente 15 €.','Cinco contactos partilhados pagos em 15 dias para limpezas domésticas na Grande Lisboa e Margem Sul.','Contacte cada cliente nas primeiras 48 horas.','Sem serviços fechados, peça a devolução entre o 14.º e o 21.º dia após o quinto contacto.','Os contactos da campanha não dão direito a substituição.']},progress:{contacts:1,purchase_deadline:'2026-12-12T12:00:00Z'},remainingContacts:4};
const payload={event_id:'engagement:workflow:BF-reminder:campaign-order',event_type:'BF-reminder',partner_email:'partner@example.invalid',partner_name:'Parceiro <Lisboa>',dashboard_url:'https://parceiros.guiadoproprietario.pt/?t=personal',data};
const request=p=>new Request('https://guiadoproprietario.pt/api/make/partner-engagement-notification',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(p)});
const config=db=>({MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,PARTNER_ENGAGEMENT_ENABLED:'true',SENDER_API_TOKEN:'test',CLEANING_DASHBOARD_API_TOKEN:'test',EMAIL_DELIVERY_DB:db});
test('campaign confirmation and reminder contain structured rules, dates and the private link',()=>{
 for(const kind of ['BF-confirmation','BF-reminder']){const m=renderPartnerEngagementEmail({...payload,event_type:kind,data:{...data,workflowKind:kind}});
 assert.match(m.html,/<ol/);assert.match(m.html,/<li/);assert.match(m.text,/15 dias/);assert.match(m.text,/48 horas/);assert.match(m.text,/substituição/);assert.match(m.text,/12 de dezembro/);assert.match(m.text,/t=personal/);assert.doesNotMatch(m.text,/<br>/);assert.doesNotMatch(m.html,/Parceiro <Lisboa>/);
 }
 assert.throws(()=>renderPartnerEngagementEmail({...payload,data:{...data,remainingContacts:3}}),/invalid_campaign_remaining/);
 assert.throws(()=>renderPartnerEngagementEmail({...payload,dashboard_url:'https://evil.invalid/?t=personal'}),/invalid_personal_link/);
});
test('Sender uses freshly recomputed remaining count and link, and delivers each campaign event only once',async()=>{
 const fixture=deliveryFixture(),original=globalThis.fetch,sent=[];
 globalThis.fetch=async(url,init)=>{
 if(String(url).endsWith('/api/partner-email-policy'))return Response.json({ok:true,allowed:true});
 if(String(url).endsWith('/api/partner-engagement-policy'))return Response.json({ok:true,allowed:true,event_type:payload.event_type,partner_name:payload.partner_name,dashboard_url:'https://parceiros.guiadoproprietario.pt/?t=current',data:{...data,progress:{...data.progress,contacts:3},remainingContacts:2}});
 assert.equal(String(url),'https://api.sender.net/v2/message/send');sent.push(JSON.parse(init.body));return Response.json({});
 };
 try{for(let i=0;i<2;i++)assert.equal((await onRequestPost({request:request(payload),env:config(fixture.binding)})).status,200);
 assert.equal(sent.length,1);assert.match(sent[0].subject,/faltam 2 contactos/);assert.match(sent[0].text,/t=current/);assert.doesNotMatch(sent[0].text,/t=personal/);
 }finally{globalThis.fetch=original;fixture.db.close();}
});
test('completed or blocked campaign reminders stop before reaching Sender',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async url=>{if(String(url).endsWith('/api/partner-email-policy'))return Response.json({ok:true,allowed:true});if(String(url).endsWith('/api/partner-engagement-policy'))return Response.json({ok:true,allowed:false});throw Error('Sender must not be called');};
 try{assert.equal((await onRequestPost({request:request(payload),env:config()})).status,200);
 const capability=await onRequestGet({request:new Request('https://test',{headers:{Authorization:'Bearer '+secret}}),env:config()});assert.equal((await capability.json()).campaign_emails_v1,1);
 }finally{globalThis.fetch=original;}
});

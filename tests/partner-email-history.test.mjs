import test from 'node:test';import assert from 'node:assert/strict';
import {deliveryFixture} from './partner-email-fixture.mjs';
import {deliverOnce} from '../functions/lib/partner-email-delivery.mjs';
import {archivePartnerEmail,readArchivedEmail} from '../functions/lib/partner-email-archive.mjs';
import {onRequestPost as history} from '../functions/api/make/partner-email-history.js';
const req=(ids,secret='secret')=>new Request('https://test',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({event_ids:ids,offset:0})});
test('history returns exact encrypted snapshot only for sent selected events; legacy body remains unknown',async()=>{
 const f=deliveryFixture(),env={EMAIL_DELIVERY_DB:f.binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:'secret'};try{
 const message={subject:'Assunto enviado',text:'Olá Maria.\nLigação privada: https://test/?t=private'};
 await deliverOnce(f.binding,'welcome:one','one@test.pt',async mark=>{await archivePartnerEmail(env,'welcome:one','one@test.pt',message);await mark();return {state:'sent'};});
 const encrypted=f.db.prepare('SELECT content_ciphertext FROM email_message_archive').get().content_ciphertext;assert.ok(!encrypted.includes('private'));assert.equal(await readArchivedEmail('wrong','welcome:one',encrypted),null);
 await deliverOnce(f.binding,'welcome:old','old@test.pt',async mark=>{await mark();return {state:'sent'};});
 await deliverOnce(f.binding,'welcome:failed','failed@test.pt',async mark=>{await archivePartnerEmail(env,'welcome:failed','failed@test.pt',message);await mark();return {state:'failed'};});
 assert.equal((await history({env,request:req(['welcome:one'],'wrong')})).status,404);
 const result=await(await history({env,request:req(['welcome:one','welcome:old','welcome:failed'])})).json();assert.equal(result.items.length,2);assert.equal(result.items.find(x=>x.event_id==='welcome:old').content,null);assert.deepEqual(result.items.find(x=>x.event_id==='welcome:one').content,{...message,recipient:'one@test.pt'});
 const one=await(await history({env,request:req(['welcome:old'])})).json();assert.equal(one.items.length,1);
 }finally{f.db.close();}
});
test('archive failure does not prevent operational delivery',async()=>{
 const f=deliveryFixture(),env={EMAIL_DELIVERY_DB:f.binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:'secret'};try{
 f.db.exec('DROP TABLE email_message_archive');let sends=0;
 const result=await deliverOnce(f.binding,'welcome:new','one@test.pt',async mark=>{await archivePartnerEmail(env,'welcome:new','one@test.pt',{subject:'test',text:'test'});await mark();sends++;return {state:'sent'};});
 assert.equal(result.status,200);assert.equal(sends,1);
 }finally{f.db.close();}
});

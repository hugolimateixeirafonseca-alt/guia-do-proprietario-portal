import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEmailCopyV2} from '../functions/lib/partner-email-copy-v2.mjs';
import {renderPlannedPartnerEmail} from '../functions/lib/partner-planned-emails.mjs';
test('payment confirmation reflects zero, one or two remaining free contacts',()=>{
 for(const render of [renderEmailCopyV2,renderPlannedPartnerEmail])for(const freeContacts of [0,1,2]){
  const message=render('P5',{name:'Parceiro',url:'https://parceiros.guiadoproprietario.pt/?t=EXEMPLO',model:'novo',bonusGranted:true,amount:1500,requests:[],freeContacts,freeSharedContacts:freeContacts,freeExclusiveContacts:0});
  assert.equal(message.subject,'Recebemos o seu carregamento de 15,00 €');
  if(!freeContacts)assert.doesNotMatch(message.text,/grátis|bónus|oferta/i);
  else assert.match(message.text,new RegExp(freeContacts+(freeContacts===1?' contacto grátis disponível':' contactos grátis disponíveis')));
 }
});
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPartnerEngagementEmail as render} from '../functions/lib/partner-engagement-email.mjs';
const payload={event_type:'contact_accepted',partner_name:'Empresa',dashboard_url:'https://parceiros.guiadoproprietario.pt/?t=test#meus',data:{kind:'client_stop',municipality:'Lisboa',modality:'exclusiva',free_contacts:1}};
test('stop email gives one verified credit and tells partner to stop contacting',()=>{const result=render(payload);const content=JSON.stringify(result);assert.match(content,/Não volte a contact/);assert.match(content,/1 contacto gratuito exclusivo/);assert.doesNotMatch(content,/undefined|null|Ligue já/);});
test('stop email rejects missing credit or locality and supports shared credit',()=>{for(const patch of [{free_contacts:0},{municipality:'null'},{modality:'other'}])assert.throws(()=>render({...payload,data:{...payload.data,...patch}}));assert.match(JSON.stringify(render({...payload,data:{...payload.data,modality:'partilhada'}})),/sem exclusividade/);});

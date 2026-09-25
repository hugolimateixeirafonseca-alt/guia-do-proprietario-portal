import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPartnerEngagementEmail} from '../functions/lib/partner-engagement-email.mjs';
const base={event_type:'approved_no_login',partner_name:'Empresa exemplo',dashboard_url:'https://parceiros.guiadoproprietario.pt/?t=example'};
test('approval reminder has truthful subject and body for zero, one and several offers',()=>{
 for(const n of [0,1,2]){
  const m=renderPartnerEngagementEmail({...base,data:{active_requests:n,free_contacts:4,localities:n?'Lisboa':''}});
  assert.ok(m.text.includes('Entrar na minha área'));assert.equal((m.html.match(/<a /g)||[]).length,1);
  assert.doesNotMatch(m.text,/null|undefined|NaN|\{\w+\}/);
  if(!n){assert.doesNotMatch(m.subject,/pedidos à sua espera/);assert.match(m.text,/Assim que entrar/);}else{assert.match(m.subject,/Lisboa/);assert.ok(m.text.includes('há '+n));}
 }
 for(const n of [null,undefined,NaN,-1,'2'])assert.throws(()=>renderPartnerEngagementEmail({...base,data:{active_requests:n,free_contacts:4,localities:'Lisboa'}}));
 assert.throws(()=>renderPartnerEngagementEmail({...base,data:{active_requests:1,free_contacts:3,localities:'Lisboa'}}));
});

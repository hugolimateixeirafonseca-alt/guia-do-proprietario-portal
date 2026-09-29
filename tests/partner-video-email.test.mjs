import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPartnerEngagementEmail} from '../functions/lib/partner-engagement-email.mjs';
test('video invitation has one link to player, clear value and no promise of guaranteed service',()=>{
 const payload={event_id:'engagement:video_tutorial:20260929:p0',event_type:'unused_free_contacts',partner_name:'Empresa <Norte>',dashboard_url:'https://parceiros.guiadoproprietario.pt/?t=private#video',data:{kind:'video_tutorial'}};
 const email=renderPartnerEngagementEmail(payload);
 assert.match(email.subject,/Veja este vídeo/);assert.match(email.text,/É você quem define o preço/);assert.match(email.html,/Empresa &lt;Norte&gt;/);assert.equal((email.html.match(/<a /g)||[]).length,1);assert.match(email.html,/#video/);assert.match(email.text,/Ver o vídeo explicativo/);
 assert.throws(()=>renderPartnerEngagementEmail({...payload,event_id:'engagement:unused_free_contacts:p0'}));assert.throws(()=>renderPartnerEngagementEmail({...payload,dashboard_url:'https://parceiros.guiadoproprietario.pt/?t=private#pedidos'}));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPartnerEngagementEmail} from '../functions/lib/partner-engagement-email.mjs';
test('retired video invitation is rejected, including historical queued payloads',()=>{
 const payload={event_id:'engagement:video_tutorial:20260929:p0',event_type:'unused_free_contacts',partner_name:'Empresa <Norte>',dashboard_url:'https://parceiros.guiadoproprietario.pt/?t=private#video',data:{kind:'video_tutorial'}};
 assert.throws(()=>renderPartnerEngagementEmail(payload),/retired_video_email/);
 assert.throws(()=>renderPartnerEngagementEmail({...payload,event_id:'engagement:unused_free_contacts:p0'}));assert.throws(()=>renderPartnerEngagementEmail({...payload,dashboard_url:'https://parceiros.guiadoproprietario.pt/?t=private#pedidos'}));
});

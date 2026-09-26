import {checkPartnerEmailPolicy} from '../../lib/partner-email-policy.mjs';
import {reserveSenderRequest, recordSenderRateLimit} from '../../lib/sender-api-control.mjs';
import {deliverOnce, providerRetryAfter} from '../../lib/partner-email-delivery.mjs';
import {renderPartnerEngagementEmail} from '../../lib/partner-engagement-email.mjs';

const json = (body: object, status = 200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const secureEqual = (left: string, right: string) => {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
};

export async function onRequestPost({request, env}: {request: Request, env: Record<string, any>}) {
  const secret = env.MAKE_PARTNER_NOTIFICATIONS_SECRET;
  if (!secret || !secureEqual(request.headers.get('Authorization') || '', `Bearer ${secret}`)) return new Response('Not Found', {status:404});
  // Explicit activation only after both applications and the Make flow are ready.
  if (env.PARTNER_ENGAGEMENT_ENABLED !== 'true') return json({error:'engagement_disabled'}, 503);
  if (!env.SENDER_API_TOKEN || !env.CLEANING_DASHBOARD_API_TOKEN) return json({error:'engagement_not_configured'}, 503);
  let payload;
  try { payload = await request.json(); } catch { return json({error:'invalid_json'}, 400); }
  if (!payload || typeof payload !== 'object' || typeof payload.event_id !== 'string' || !/^engagement:[a-z0-9:_-]{8,180}$/i.test(payload.event_id)) return json({error:'invalid_event_id'}, 400);
  const email = typeof payload.partner_email === 'string' ? payload.partner_email.trim().toLowerCase() : '';
  const preview = env.APP_ENV === 'preview';
  if (preview && (env.PARTNER_ENGAGEMENT_TEST_MODE !== 'true' || !env.PARTNER_ENGAGEMENT_TEST_EMAIL || email !== env.PARTNER_ENGAGEMENT_TEST_EMAIL.trim().toLowerCase() || env.CLEANING_DASHBOARD_API_URL !== 'https://engagement-test.guia-do-proprietario-parceiros.pages.dev')) return json({error:'test_recipient_blocked'},403);
  if (!preview && env.PARTNER_ENGAGEMENT_TEST_MODE === 'true') return json({error:'test_environment_blocked'},403);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof payload.partner_name !== 'string' || !payload.partner_name.trim() || payload.partner_name.length > 120) return json({error:'invalid_recipient'}, 400);
  let message;
  try { message = renderPartnerEngagementEmail(payload,{preview}); } catch { return json({error:'invalid_engagement_payload'}, 400); }
  try {
    if (!await checkPartnerEmailPolicy(env, email, payload.event_id)) return json({ok:true, suppressed:true, event_id:payload.event_id});
    const policyUrl = new URL('/api/partner-engagement-policy', env.CLEANING_DASHBOARD_API_URL || 'https://guia-do-proprietario-parceiros.pages.dev');
    const policy = await fetch(policyUrl, {method:'POST', headers:{Authorization:`Bearer ${env.CLEANING_DASHBOARD_API_TOKEN}`,'Content-Type':'application/json'}, body:JSON.stringify({event_id:payload.event_id, email}), signal:AbortSignal.timeout(8000)});
    if (!policy.ok) return json({error:'engagement_policy_unavailable'}, 503);
    const result = await policy.json() as {ok?:boolean, allowed?:boolean, data?:unknown, event_type?:string, partner_name?:string,dashboard_url?:string};
    if (result.ok !== true || typeof result.allowed !== 'boolean') return json({error:'engagement_policy_unavailable'}, 503);
    if (!result.allowed) return json({ok:true, suppressed:true, event_id:payload.event_id});
    // Use freshly checked values, not an old snapshot waiting inside Make.
    if(result.event_type!==payload.event_type || !result.data || !result.partner_name)return json({error:'engagement_policy_unavailable'},503);
    message=renderPartnerEngagementEmail({...payload,data:result.data,partner_name:result.partner_name,dashboard_url:result.dashboard_url||payload.dashboard_url},{preview});
  } catch { return json({error:'engagement_policy_unavailable'}, 503); }
  return deliverOnce(env.EMAIL_DELIVERY_DB, payload.event_id, email, async (markSending: () => Promise<void>) => {
    await reserveSenderRequest(env.EMAIL_DELIVERY_DB);
    await markSending();
    const response = await fetch('https://api.sender.net/v2/message/send', {
      method:'POST', signal:AbortSignal.timeout(12000), headers:{Authorization:`Bearer ${env.SENDER_API_TOKEN}`, Accept:'application/json','Content-Type':'application/json'},
      body:JSON.stringify({from:{email:'geral@guiadoproprietario.pt',name:'Guia do Proprietário'}, to:{email,name:payload.partner_name}, ...message, ...(preview ? {subject:`[TESTE] ${message.subject}`} : {}), headers:{'X-GP-Event-ID':payload.event_id,charset:'utf-8'}})
    });
    if (!response.ok) {
      await recordSenderRateLimit(env.EMAIL_DELIVERY_DB, response, 'email');
      return {state:response.status === 429 ? 'retry' : response.status >= 500 ? 'uncertain' : 'failed', error:response.status === 429 ? 'sender_rate_limited' : response.status >= 500 ? 'sender_response_unknown' : 'sender_rejected', providerStatus:response.status, retryAfter:providerRetryAfter(response.headers),status:503};
    }
    return {state:'sent'};
  });
}

// Version handshake: a new digest is queued only after this renderer is deployed.
export async function onRequestGet({request,env}: {request: Request,env: Record<string,any>}) {
 if (!env.MAKE_PARTNER_NOTIFICATIONS_SECRET || !secureEqual(request.headers.get('Authorization') || '', 'Bearer '+env.MAKE_PARTNER_NOTIFICATIONS_SECRET)) return new Response('Not Found',{status:404});
 return json({request_digest:1});
}

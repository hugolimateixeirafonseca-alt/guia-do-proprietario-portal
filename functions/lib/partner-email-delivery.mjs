const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const response=(body,status)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
// Dedicated EMAIL_DELIVERY_DB. No addresses, payloads or access tokens are stored.
export async function deliverOnce(db,eventId,email,deliver) {
 if(!db)return response({error:'delivery_store_unavailable'},503);
 const now=Math.floor(Date.now()/1000),recipient=await hash(email);
 try {
  const cooldown=await db.prepare("SELECT blocked_until FROM provider_cooldown WHERE provider='sender'").first();
  if(cooldown?.blocked_until>now)return response({error:'sender_cooldown',retry_after:cooldown.blocked_until-now},503);
  const claimed=await db.prepare(`INSERT INTO email_delivery(event_id,recipient_hash,state,lease_until,updated_at)
   VALUES (?,?,'processing',?,?) ON CONFLICT(event_id) DO UPDATE SET state='processing',attempts=attempts+1,lease_until=excluded.lease_until,updated_at=excluded.updated_at
   WHERE email_delivery.recipient_hash=excluded.recipient_hash AND attempts<6 AND
   ((state='retry' AND next_attempt<=excluded.updated_at) OR (state='processing' AND lease_until<excluded.updated_at)) RETURNING attempts`).bind(eventId,recipient,now+180,now).first();
  if(!claimed){
   const row=await db.prepare('SELECT recipient_hash,state,attempts FROM email_delivery WHERE event_id=?').bind(eventId).first();
   if(row?.recipient_hash!==recipient)return response({error:'event_recipient_conflict'},409);
   if(row.state==='sent')return response({ok:true,event_id:eventId,duplicate:true},200);
   return response({error:['sending','uncertain'].includes(row.state)?'delivery_requires_review':row.attempts>=6?'delivery_attempts_exhausted':'delivery_pending',state:row.state},503);
  }
  let sending=false,outcome;
  try {
   outcome=await deliver(async()=>{
    await db.prepare("UPDATE email_delivery SET state='sending',updated_at=? WHERE event_id=?").bind(now,eventId).run();
    sending=true;
   });
  } catch {
   outcome={state:sending?'uncertain':'retry',error:sending?'sender_response_unknown':'pre_send_unavailable',status:503};
  }
  if(outcome.state==='retry'&&claimed.attempts>=6)outcome={...outcome,state:'failed',error:'delivery_attempts_exhausted'};
  const next=now+Math.max(Math.min(60*2**(claimed.attempts-1),1800),Number(outcome.retryAfter)||0);
  if(outcome.providerStatus===429){
   await db.prepare("INSERT INTO provider_cooldown(provider,blocked_until) VALUES ('sender',?) ON CONFLICT(provider) DO UPDATE SET blocked_until=MAX(blocked_until,excluded.blocked_until)").bind(next).run();
  }
  await db.prepare('UPDATE email_delivery SET state=?,updated_at=?,next_attempt=?,provider_status=?,error_code=? WHERE event_id=?').bind(outcome.state,Math.floor(Date.now()/1000),next,outcome.providerStatus||null,outcome.error||null,eventId).run();
  if(outcome.state==='sent')return response({ok:true,event_id:eventId},200);
  console.error('partner_email_delivery_failed',JSON.stringify({eventId,state:outcome.state,stage:outcome.stage||'send',providerStatus:outcome.providerStatus||0,error:outcome.error,attempt:claimed.attempts}));
  return response({error:outcome.error,stage:outcome.stage||'send',provider_status:outcome.providerStatus||0,state:outcome.state},outcome.status||503);
 } catch {
  console.error('partner_email_delivery_store_error',JSON.stringify({eventId}));
  return response({error:'delivery_store_error'},503);
 }
}

export function providerRetryAfter(headers) {
 const raw=headers.get('retry-after');
 const seconds=Number(raw);
 if(raw&&Number.isFinite(seconds)&&seconds>=0)return Math.ceil(seconds);
 const date=Date.parse(raw||headers.get('x-ratelimit-reset')||'');
 if(Number.isFinite(date))return Math.max(0,Math.ceil((date-Date.now())/1000));
 return 0;
}

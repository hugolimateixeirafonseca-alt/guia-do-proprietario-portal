// Owner-approved one-off invitation. Disabled outside the publication window.
import {deliverOnce,providerRetryAfter} from '../lib/partner-email-delivery.mjs';
import {reserveSenderRequest,recordSenderRateLimit} from '../lib/sender-api-control.mjs';
import {archivePartnerEmail} from '../lib/partner-email-archive.mjs';
const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const equal=(a,b)=>{if(!a||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
export async function onRequestPost({request,env}){
 if(env.APP_ENV==='preview'||Date.now()>=Date.parse('2026-11-27T00:00:00Z')||!env.CAMPAIGN_FLASH_DISPATCH_KEY||!equal(request.headers.get('Authorization')||'','Bearer '+env.CAMPAIGN_FLASH_DISPATCH_KEY))return new Response('Not Found',{status:404});
 if(await env.EMAIL_DELIVERY_DB?.prepare("SELECT 1 FROM provider_cooldown WHERE provider='campaign_flash_closed'").first())return new Response('Not Found',{status:404});
 if(!env.SENDER_API_TOKEN||!env.CLEANING_DASHBOARD_API_TOKEN)return json({error:'not_configured'},503);
 let b;try{b=await request.json();}catch{return json({error:'invalid_json'},400);}
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(String(b.partner_id||'')))return json({error:'invalid_partner'},400);
 const policy=async prepare=>{
  const url=new URL('/api/black-friday-invitation',env.CLEANING_DASHBOARD_API_URL||'https://guia-do-proprietario-parceiros.pages.dev');
  const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+env.CLEANING_DASHBOARD_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({partner_id:b.partner_id,prepare}),signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('policy_unavailable');return r.json();
 };
 try{
  let p=await policy(false);if(!p.allowed)return json({ok:true,suppressed:true,reason:p.reason||'policy'});
  // Read provider suppression without subscribing or reactivating anybody.
  let found=null,page=1;
  while(true){await reserveSenderRequest(env.EMAIL_DELIVERY_DB);const r=await fetch('https://api.sender.net/v2/subscribers?limit=1000&page='+page,{headers:{Authorization:'Bearer '+env.SENDER_API_TOKEN,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
   if(!r.ok)return json({error:'suppression_unavailable'},503);const d=await r.json();if(!Array.isArray(d.data))return json({error:'suppression_unavailable'},503);
   found=d.data.find(s=>String(s.email).trim().toLowerCase()===p.email);if(found||page>=Number(d.meta?.last_page||1))break;if(++page>10)return json({error:'suppression_unavailable'},503);
  }
  if(found&&(!found.status||!Object.keys(found.status).length||Object.values(found.status).some(v=>String(v).toLowerCase()!=='active')))return json({ok:true,suppressed:true,reason:'provider_opt_out'});
  if(b.send!==true)return json({ok:true,eligible:true,count:p.count});
  return deliverOnce(env.EMAIL_DELIVERY_DB,p.event_id,p.email,async markSending=>{
   const fresh=await policy(true);if(!fresh.allowed||fresh.email!==p.email||fresh.event_id!==p.event_id)return {state:'failed',error:'eligibility_changed',status:409};p=fresh;
   await reserveSenderRequest(env.EMAIL_DELIVERY_DB);
   await archivePartnerEmail(env,p.event_id,p.email,p.message);
   await markSending();
   const r=await fetch('https://api.sender.net/v2/message/send',{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+env.SENDER_API_TOKEN,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({from:{email:'geral@guiadoproprietario.pt',name:'Hugo · Guia do Proprietário'},to:{email:p.email,name:p.name},...p.message,headers:{'X-GP-Event-ID':p.event_id,charset:'utf-8'}})});
   if(!r.ok){await recordSenderRateLimit(env.EMAIL_DELIVERY_DB,r,'email');return {state:r.status===429?'retry':r.status>=500?'uncertain':'failed',error:r.status===429?'sender_rate_limited':'sender_rejected',providerStatus:r.status,retryAfter:providerRetryAfter(r.headers),status:503};}
   const result=await r.json();if(result.success!==true)return {state:'uncertain',error:'sender_response_unknown',status:503};
   return {state:'sent'};
  });
 }catch{return json({error:'campaign_unavailable'},503);}
}

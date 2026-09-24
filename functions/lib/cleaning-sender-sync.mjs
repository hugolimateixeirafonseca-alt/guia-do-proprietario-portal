import {reserveSenderRequest,pauseSender,SenderPause,recordSenderRateLimit} from './sender-api-control.mjs';
const API='https://api.sender.net/v2';
export class SyncError extends Error {
 constructor(code,status=0,retryMs=300000){super(code);this.status=status;this.retryMs=retryMs;}
}
async function sender(env,path,method='GET',body){
 await reserveSenderRequest(env.EMAIL_DELIVERY_DB);
 let response;
 try{response=await fetch(API+path,{method,headers:{Authorization:`Bearer ${env.SENDER_API_TOKEN}`,Accept:'application/json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});}catch{throw new SyncError('network');}
 if(response.status===429){
  await recordSenderRateLimit(env.EMAIL_DELIVERY_DB,response,method==='GET'?'lookup':'write');
  const retry=response.headers.get('Retry-After'),seconds=Number(retry);
  const error=new SyncError('sender_429',429,Math.max(60000,Number.isFinite(seconds)&&seconds>0?seconds*1000:(Date.parse(retry)-Date.now())||300000));
  // Only allowlisted operational metadata. Never expose provider bodies, URLs or contacts.
  const numeric=name=>{const value=response.headers.get(name);return value&&/^\d+$/.test(value)?Number(value):null;};
  const contentType=response.headers.get('Content-Type')||'';
  const raw=await response.text();
  error.diagnostics={operation:method==='GET'?'lookup':path==='/subscribers'?'create':'group',limit:numeric('X-RateLimit-Limit'),remaining:numeric('X-RateLimit-Remaining'),reset:numeric('X-RateLimit-Reset'),retryAfterSeconds:Number.isFinite(seconds)?seconds:null,responseType:contentType.includes('json')?'json':contentType.includes('html')?'html':'other',edgeBlock:/cloudflare|error 1015|error 1020/i.test(raw),reason:/too many requests/i.test(raw)?'too_many_requests':/rate limit/i.test(raw)?'rate_limit':'unspecified'};
  await pauseSender(env.EMAIL_DELIVERY_DB,Math.ceil(error.retryMs/1000));
  throw error;
 }
 return response;
}
async function profile(env,email){const r=await sender(env,'/subscribers/'+encodeURIComponent(email));if(r.status===404)return null;if(!r.ok)throw new SyncError('lookup_'+r.status,r.status);const j=await r.json();if(!j.data?.id||!Array.isArray(j.data.subscriber_tags))throw new SyncError('invalid_profile');return j.data;}
const memberIds=p=>new Set((p?.subscriber_tags||[]).map(g=>String(g.id)));
const suppressed=p=>p?.status?.email && p.status.email!=='active';
export async function syncLead(env,lead){
 return syncContact(env,lead,['bWv1LJ',...(lead.consentimento_marketing===1?['egK8WG']:[])]);
}
export async function syncPartner(env,partner){
 if(!partner)return {state:'suppressed',code:'partner_removed'};
 if(partner.bloquear_email===1 || partner.bloquear_email===true){
  const current=await profile(env,partner.email);
  if(!current)return {state:'suppressed',code:'admin_optout_no_profile'};
  const r=await sender(env,'/subscribers/'+encodeURIComponent(partner.email),'PATCH',{
   subscriber_status:'UNSUBSCRIBED',transactional_email_status:'UNSUBSCRIBED',trigger_automation:false
  });
  if(!r.ok)throw new SyncError('unsubscribe_'+r.status,r.status);
  const result=await r.json();
  if(result.success!==true)throw new SyncError('unsubscribe_unconfirmed');
  return {state:'suppressed',code:'admin_optout_synced'};
 }
 return syncContact(env,partner,['aOoGvG'],true);
}
async function syncContact(env,lead,required,membershipOnly=false){
 let current=await profile(env,lead.email),created=false,added=0;
 if(!membershipOnly&&current&&suppressed(current))return {state:'suppressed',code:'existing_optout',created,added};
 if(!current){
  const fields={'{$CONSENT_DATA}':lead.consentimento_marketing_em||lead.consentimento_parceiros_em,'{$LEAD_SOURCE}':lead.origem,...(lead.consentimento_marketing===1?{'{$CONSENT_MARKETING}':'true'}:{})};
  const r=await sender(env,'/subscribers','POST',{email:lead.email,firstname:lead.nome,groups:required,fields,trigger_automation:false});
  if(!r.ok&&r.status!==409)throw new SyncError('create_'+r.status,r.status);
  created=r.ok;
  current=await profile(env,lead.email);
  if(!current)throw new SyncError('create_unconfirmed');
  if(!membershipOnly&&suppressed(current))return {state:'suppressed',code:'existing_optout',created,added};
 }
 const originalStatus=JSON.stringify(current.status);
 for(const group of required.filter(g=>!memberIds(current).has(g))){
  const r=await sender(env,'/subscribers/groups/'+group,'POST',{subscribers:[lead.email],trigger_automation:false});
  if(!r.ok)throw new SyncError('group_'+r.status,r.status);
  added++;
 }
 if(added)current=await profile(env,lead.email);
 if(membershipOnly&&current&&JSON.stringify(current.status)!==originalStatus)throw new SyncError('subscriber_status_changed',422);
 if(!current||!required.every(g=>memberIds(current).has(g)))throw new SyncError('groups_unconfirmed');
 return {state:'synced',code:created?'created':added?'groups_added':'already_present',created,added};
}
async function queue(env,body,partner=false){
 const base=env.CLEANING_DASHBOARD_API_URL||'https://guia-do-proprietario-parceiros.pages.dev/api/leads';
 const url=new URL(partner?'/api/partner-sender-sync':'/api/sender-sync',base);
 const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${env.CLEANING_DASHBOARD_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error('queue_'+r.status);
 return r.json();
}
export async function processSenderSync(env,partner=false){
 if(!env.SENDER_API_TOKEN||!env.CLEANING_DASHBOARD_API_TOKEN)throw new Error('sync_not_configured');
 const {job}=await queue(env,{action:'claim'},partner);
 if(!job)return partner?{state:'idle'}:processSenderSync(env,true);
 let result;
 try{result=partner?await syncPartner(env,job.partner):await syncLead(env,job.lead);}catch(error){
  const status=Number(error.status)||0;
  const blocked=status>=400&&status<500&&![408,409,429].includes(status);
  result={state:blocked?'blocked':'pending',code:error.diagnostics?['sender_429',error.diagnostics.operation,'l'+error.diagnostics.limit,'r'+error.diagnostics.remaining,'edge'+Number(error.diagnostics.edgeBlock)].join('_'):error instanceof SyncError||error instanceof SenderPause?error.message:'unexpected',retry_ms:Math.max(error.retryMs||0,Math.min(21600000,60000*2**Math.min(job.attempts,9))),cooldown:status===429,...(error.diagnostics?{diagnostics:error.diagnostics}:{})};
 }
 await queue(env,{action:'finish',...(partner?{partner_id:job.partner_id}:{lead_id:job.lead_id}),lease:job.lease,...result},partner);
 return result;
}
export async function senderSyncStats(env){
 const [leads,partners]=await Promise.all([queue(env,{action:'stats'}),queue(env,{action:'stats'},true)]);
 const totals=new Map();for(const row of [...leads.states,...partners.states])totals.set(row.state,(totals.get(row.state)||0)+row.count);
 return {ok:true,states:[...totals].map(([state,count])=>({state,count})),partners:partners.states};
}

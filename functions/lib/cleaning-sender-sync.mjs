const API='https://api.sender.net/v2';
export class SyncError extends Error {
 constructor(code,status=0,retryMs=300000){super(code);this.status=status;this.retryMs=retryMs;}
}
async function sender(env,path,method='GET',body){
 let response;
 try{response=await fetch(API+path,{method,headers:{Authorization:`Bearer ${env.SENDER_API_TOKEN}`,Accept:'application/json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});}catch{throw new SyncError('network');}
 if(response.status===429){const retry=response.headers.get('Retry-After');const seconds=Number(retry);throw new SyncError('sender_429',429,Math.max(60000,Number.isFinite(seconds)&&seconds>0?seconds*1000:(Date.parse(retry)-Date.now())||300000));}
 return response;
}
async function profile(env,email){const r=await sender(env,'/subscribers/'+encodeURIComponent(email));if(r.status===404)return null;if(!r.ok)throw new SyncError('lookup_'+r.status,r.status);const j=await r.json();if(!j.data?.id||!Array.isArray(j.data.subscriber_tags))throw new SyncError('invalid_profile');return j.data;}
const memberIds=p=>new Set((p?.subscriber_tags||[]).map(g=>String(g.id)));
const suppressed=p=>p?.status?.email && p.status.email!=='active';
export async function syncLead(env,lead){
 return syncContact(env,lead,['bWv1LJ',...(lead.consentimento_marketing===1?['egK8WG']:[])]);
}
export async function syncPartner(env,partner){return syncContact(env,partner,['aOoGvG']);}
async function syncContact(env,lead,required){
 let current=await profile(env,lead.email),created=false,added=0;
 if(current&&suppressed(current))return {state:'suppressed',code:'existing_optout',created,added};
 if(!current){
  const fields={'{$CONSENT_DATA}':lead.consentimento_marketing_em||lead.consentimento_parceiros_em,'{$LEAD_SOURCE}':lead.origem,...(lead.consentimento_marketing===1?{'{$CONSENT_MARKETING}':'true'}:{})};
  const r=await sender(env,'/subscribers','POST',{email:lead.email,firstname:lead.nome,groups:required,fields,trigger_automation:false});
  if(!r.ok&&r.status!==409)throw new SyncError('create_'+r.status,r.status);
  created=r.ok;
  current=await profile(env,lead.email);
  if(!current)throw new SyncError('create_unconfirmed');
  if(suppressed(current))return {state:'suppressed',code:'existing_optout',created,added};
 }
 for(const group of required.filter(g=>!memberIds(current).has(g))){
  const r=await sender(env,'/subscribers/groups/'+group,'POST',{subscribers:[lead.email],trigger_automation:false});
  if(!r.ok)throw new SyncError('group_'+r.status,r.status);
  added++;
 }
 if(added)current=await profile(env,lead.email);
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
  result={state:blocked?'blocked':'pending',code:error instanceof SyncError?error.message:'unexpected',retry_ms:Math.max(error.retryMs||0,Math.min(21600000,60000*2**Math.min(job.attempts,9))),cooldown:status===429};
 }
 await queue(env,{action:'finish',...(partner?{partner_id:job.partner_id}:{lead_id:job.lead_id}),lease:job.lease,...result},partner);
 return result;
}
export async function senderSyncStats(env){
 const [leads,partners]=await Promise.all([queue(env,{action:'stats'}),queue(env,{action:'stats'},true)]);
 const totals=new Map();for(const row of [...leads.states,...partners.states])totals.set(row.state,(totals.get(row.state)||0)+row.count);
 return {ok:true,states:[...totals].map(([state,count])=>({state,count})),partners:partners.states};
}

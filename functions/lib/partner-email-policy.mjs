// Fail closed: a queued Make event must recheck the current partner preferences.
export async function checkPartnerEmailPolicy(env,email,eventId){
 if(!env.CLEANING_DASHBOARD_API_TOKEN)throw new Error('email_policy_not_configured');
 const url=new URL('/api/partner-email-policy',env.CLEANING_DASHBOARD_API_URL||'https://guia-do-proprietario-parceiros.pages.dev/api/leads');
 const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${env.CLEANING_DASHBOARD_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({email,event_id:eventId}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('email_policy_unavailable');
 const result=await response.json();
 if(result.ok!==true || typeof result.allowed!=='boolean')throw new Error('email_policy_invalid');
 return result.allowed;
}

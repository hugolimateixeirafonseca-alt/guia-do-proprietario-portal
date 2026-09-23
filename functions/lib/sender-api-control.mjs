// Account-wide coordination for partner emails and cleaning subscriber sync.
export class SenderPause extends Error {
 constructor(retryAfter){super('sender_cooldown');this.status=429;this.retryMs=retryAfter*1000;this.retryAfter=retryAfter;}
}
export async function reserveSenderRequest(db){
 if(!db)return; // Existing callers without the delivery binding keep their current behaviour.
 for(let attempt=0;attempt<8;attempt++){
  const now=Date.now();
  const cooldown=await db.prepare("SELECT blocked_until FROM provider_cooldown WHERE provider='sender'").first();
  if(cooldown?.blocked_until>now/1000)throw new SenderPause(Math.ceil(cooldown.blocked_until-now/1000));
  const reserved=await db.prepare("INSERT INTO provider_cooldown(provider,blocked_until) VALUES ('sender_request_gate',?) ON CONFLICT(provider) DO UPDATE SET blocked_until=excluded.blocked_until WHERE blocked_until<=? RETURNING blocked_until").bind(now+2000,now).first();
  if(reserved)return;
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 throw new SenderPause(30);
}
export async function pauseSender(db,seconds){
 if(!db)return;
 await db.prepare("INSERT INTO provider_cooldown(provider,blocked_until) VALUES ('sender',?) ON CONFLICT(provider) DO UPDATE SET blocked_until=MAX(blocked_until,excluded.blocked_until)").bind(Math.ceil(Date.now()/1000)+Math.max(60,seconds)).run();
}

// Operational counters only. Never persist provider bodies, recipients or credentials.
export async function recordSenderRateLimit(db,response,operation){
 if(!db||response.status!==429)return;
 try{
  const numeric=name=>{const v=response.headers.get(name);return v&&/^\d+$/.test(v)?Number(v):-1;};
  const raw=await response.clone().text();
  const reset=response.headers.get('x-ratelimit-reset');
  const parsedReset=reset&&/^\d+$/.test(reset)?Number(reset):Math.floor(Date.parse(reset||'')/1000);
  const values={at:Math.floor(Date.now()/1000),operation:operation==='email'?2:operation==='lookup'?1:3,
   limit:numeric('x-ratelimit-limit'),remaining:numeric('x-ratelimit-remaining'),reset:Number.isFinite(parsedReset)?parsedReset:-1,
   retry:numeric('retry-after'),edge:/cloudflare|error 1015|error 1020/i.test(raw)?1:0,
   quota:/quota|daily|monthly|billing|plan limit/i.test(raw)?1:0};
  for(const [key,value] of Object.entries(values))await db.prepare('INSERT INTO provider_cooldown(provider,blocked_until) VALUES (?,?) ON CONFLICT(provider) DO UPDATE SET blocked_until=excluded.blocked_until').bind('sender_diagnostic_'+key,value).run();
 }catch{/* Diagnostics must not alter delivery outcomes. */}
}

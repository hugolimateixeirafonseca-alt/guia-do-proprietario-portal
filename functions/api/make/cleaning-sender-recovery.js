import {onRequestPost as banho} from '../pdf-casa-de-banho';
import {onRequestPost as janelas} from '../kit-trocar-janelas';
import {openRecord} from '../../lib/consent-archive.mjs';
import {processSenderSync,senderSyncStats} from '../../lib/cleaning-sender-sync.mjs';
export async function onRequestPost({request,env}){
 const expected=env.MAKE_PARTNER_NOTIFICATIONS_SECRET;
 if(!expected||request.headers.get('Authorization')!==`Bearer ${expected}`)return new Response('Not Found',{status:404});
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 try{
  let backfilled=0,nextCursor=null;
  const body=await request.json().catch(()=>({}));
  if(body.backfillPdfSince){
   const since=Date.parse(body.backfillPdfSince);
   if(!Number.isFinite(since)||since<Date.now()-7*86400000||since>Date.now())return json({error:'invalid_recovery_window'},400);
   const rows=await env.CONSENT_ARCHIVE_DB.prepare('SELECT sequence,id,payload FROM consent_evidence WHERE received_at>=? AND sequence>? ORDER BY sequence LIMIT 50').bind(new Date(since).toISOString(),Math.max(0,Number(body.cursor)||0)).all();
   for(const row of rows.results){
    const evidence=await openRecord(env,row);
    if(await banho.backfill(env,evidence)||await janelas.backfill(env,evidence))backfilled++;
   }
   if(rows.results.length===50)nextCursor=rows.results.at(-1).sequence;
  }
  const pdf=[await banho.recover(env),await janelas.recover(env)];
  const result=await processSenderSync(env);
  const stats=await senderSyncStats(env);
  return json({ok:result.state!=='blocked',result,states:stats.states,pdf,backfilled,nextCursor},result.state==='blocked'?502:200);
 }catch{return json({ok:false,error:'sync_unavailable'},503);}
}

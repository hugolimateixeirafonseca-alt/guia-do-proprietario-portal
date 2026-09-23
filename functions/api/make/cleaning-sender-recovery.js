import {processSenderSync,senderSyncStats} from '../../lib/cleaning-sender-sync.mjs';
export async function onRequestPost({request,env}){
 const expected=env.MAKE_PARTNER_NOTIFICATIONS_SECRET;
 if(!expected||request.headers.get('Authorization')!==`Bearer ${expected}`)return new Response('Not Found',{status:404});
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 try{
  const result=await processSenderSync(env);
  const stats=await senderSyncStats(env);
  return json({ok:result.state!=='blocked',result,states:stats.states},result.state==='blocked'?502:200);
 }catch{return json({ok:false,error:'sync_unavailable'},503);}
}

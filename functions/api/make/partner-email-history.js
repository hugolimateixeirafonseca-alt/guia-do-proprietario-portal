import {readArchivedEmail} from '../../lib/partner-email-archive.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
 const expected=env.MAKE_PARTNER_NOTIFICATIONS_SECRET;
 if(!expected||request.headers.get('Authorization')!=='Bearer '+expected)return json({ok:false},404);
 try{
  const body=await request.json();
  if(!Array.isArray(body.event_ids)||body.event_ids.length>10000||body.event_ids.some(id=>typeof id!=='string'||id.length>200)||!Number.isSafeInteger(body.offset)||body.offset<0)return json({ok:false},400);
  const ids=JSON.stringify(body.event_ids);
  const rows=(await env.EMAIL_DELIVERY_DB.prepare("SELECT d.event_id,d.updated_at,a.content_ciphertext FROM email_delivery d LEFT JOIN email_message_archive a ON a.event_id=d.event_id WHERE d.state='sent' AND d.event_id IN (SELECT value FROM json_each(?)) ORDER BY d.updated_at DESC,d.event_id DESC LIMIT 51 OFFSET ?").bind(ids,body.offset).all()).results||[];
  const more=rows.length>50;
  const items=await Promise.all(rows.slice(0,50).map(async row=>({event_id:row.event_id,sent_at:new Date(row.updated_at*1000).toISOString(),content:await readArchivedEmail(expected,row.event_id,row.content_ciphertext)})));
  return json({ok:true,items,next_offset:more?body.offset+50:null});
 }catch{return json({ok:false,error:'history_unavailable'},503);}
}

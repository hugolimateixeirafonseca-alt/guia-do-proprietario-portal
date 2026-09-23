import {openRecord} from './consent-archive.mjs';
import {deliverOnce} from './partner-email-delivery.mjs';

export async function enqueuePdf(db,evidence,emailHash){
 const now=new Date().toISOString();
 await db.prepare(`INSERT INTO pdf_delivery_jobs(request_id,evidence_id,email_hash,created_at,updated_at)
 VALUES (?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING`).bind(evidence.event_id,evidence.id,emailHash,now,now).run();
 const row=await db.prepare('SELECT evidence_id,email_hash,state FROM pdf_delivery_jobs WHERE request_id=?').bind(evidence.event_id).first();
 if(!row||row.evidence_id!==evidence.id||row.email_hash!==emailHash)throw Error('pdf_request_conflict');
 return row;
}

export async function processPdfJob(env,config,deliver,requestId){
 const db=env[config.dbBinding];
 if(!db||!env.EMAIL_DELIVERY_DB||!env.CONSENT_ARCHIVE_DB||!env.CONSENT_ARCHIVE_KEY)return {state:'unavailable'};
 const now=Date.now(),lease=crypto.randomUUID();
 const row=await db.prepare(`UPDATE pdf_delivery_jobs SET state='running',lease=?,lease_until=?,attempts=attempts+1,updated_at=?
 WHERE request_id=(SELECT request_id FROM pdf_delivery_jobs WHERE
 ((state='pending' AND next_at<=?) OR (state='running' AND lease_until<?))
 AND (? IS NULL OR request_id=?) ORDER BY created_at LIMIT 1) RETURNING *`)
 .bind(lease,now+300000,new Date(now).toISOString(),now,now,requestId||null,requestId||null).first();
 if(!row)return {state:'idle'};
 let state='pending',code='pre_send_unavailable',retry=300;
 try{
  const archived=await env.CONSENT_ARCHIVE_DB.prepare('SELECT id,payload FROM consent_evidence WHERE id=?').bind(row.evidence_id).first();
  if(!archived)throw Error('pdf_evidence_missing');
  const evidence=await openRecord(env,archived);
  if(evidence.source!==config.source||evidence.consent_version!==config.consentVersion||evidence.event_id!==row.request_id||evidence.choices?.c1!==true)throw Error('pdf_evidence_invalid');
  const response=await deliverOnce(env.EMAIL_DELIVERY_DB,`pdf:${config.source}:${row.request_id}`,evidence.email,
   markSending=>deliver(evidence,row,markSending));
  const result=await response.json();
  if(response.ok){state='sent';code='sent';}
  else{
   code=result.error||'delivery_pending';
   if(['delivery_requires_review','delivery_attempts_exhausted','event_recipient_conflict'].includes(code)||['failed','uncertain','sending'].includes(result.state))state='review';
   retry=Math.max(60,Number(result.retry_after)||300);
  }
 }catch(error){
  // No uncertain email is retried: deliverOnce owns the sending marker.
  if(error?.message?.startsWith('pdf_evidence_')){state='review';code=error.message;}
 }
 await db.prepare('UPDATE pdf_delivery_jobs SET state=?,last_code=?,next_at=?,lease=NULL,lease_until=0,updated_at=? WHERE request_id=? AND lease=?')
 .bind(state,code,Date.now()+retry*1000,new Date().toISOString(),row.request_id,lease).run();
 return {state,code};
}

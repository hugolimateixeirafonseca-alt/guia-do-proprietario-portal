const enc=new TextEncoder(),dec=new TextDecoder();
const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
async function key(secret){if(!secret)throw Error('archive_key_missing');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode('email-archive:v1:'+secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function archivePartnerEmail(env,eventId,recipient,message){
 try{
  const content={subject:message.subject,text:message.text,recipient};
  if(typeof content.subject!=='string'||typeof content.text!=='string')throw Error('archive_content_missing');
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(eventId)},await key(env.MAKE_PARTNER_NOTIFICATIONS_SECRET),enc.encode(JSON.stringify(content)));
  await env.EMAIL_DELIVERY_DB.prepare('INSERT INTO email_message_archive(event_id,content_ciphertext,captured_at) VALUES(?,?,?) ON CONFLICT(event_id) DO UPDATE SET content_ciphertext=excluded.content_ciphertext,captured_at=excluded.captured_at').bind(eventId,'v1.'+encode(iv)+'.'+encode(encrypted),Math.floor(Date.now()/1000)).run();
 }catch{console.warn('partner_email_archive_unavailable');} // Do not interrupt operational email delivery.
}
export async function readArchivedEmail(secret,eventId,ciphertext){
 if(!ciphertext)return null;
 try{const [version,iv,data]=ciphertext.split('.');if(version!=='v1')return null;
 return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:enc.encode(eventId)},await key(secret),decode(data))));}catch{return null;}
}

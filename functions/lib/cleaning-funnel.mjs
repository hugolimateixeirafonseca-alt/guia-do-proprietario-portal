import {measurementChoice} from '../../src/lib/cleaning-measurement.mjs';
export const FUNNEL_EVENTS = new Set(['page','step','results','select','network','redirect','invalid','submit','success','failure','leave','script_error','phone_edit','profile','start']);
export const FUNNEL_DETAILS = new Set(['','available','none','unavailable','premium','network','other_landing','conflict','server','network_error','script','resource','unhandled','zone','frequency','space','size','area','days','periods','name','email','phone','postal','timing','date','channels','permission','plan','other']);
const choices=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
export function validateFunnel(body, request, now=Date.now()) {
 const url=new URL(request.url);
 if(!['guiadoproprietario.pt','www.guiadoproprietario.pt'].includes(url.hostname)||request.headers.get('Origin')!==url.origin)throw Error('origin');
 if(measurementChoice(request.headers.get('Cookie')||'',now)!=='accepted')throw Error('consent');
 if(!body||body.version!==1||!/^pedir-v1$/.test(body.journey)||!/^([0-9a-f]{8}-){1}[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.session))throw Error('session');
 if(!Array.isArray(body.events)||!body.events.length||body.events.length>20)throw Error('events');
 if(!Number.isSafeInteger(body.started)||body.started>now+300000||body.started<now-86400000)throw Error('time');
 const events=body.events.map(e=>{
  if(!e||!Number.isInteger(e.seq)||e.seq<0||e.seq>79||!FUNNEL_EVENTS.has(e.name)||!Number.isInteger(e.stage)||e.stage<1||e.stage>6||!FUNNEL_DETAILS.has(e.detail)||!Number.isSafeInteger(e.at)||e.at<body.started||e.at>now+300000||e.at<now-86400000||!Number.isInteger(e.elapsed)||e.elapsed<0||e.elapsed>1800000)throw Error('event');
  return {seq:e.seq,name:e.name,stage:e.stage,detail:e.detail,elapsed:e.elapsed,at:e.at};
 });
 return {id:body.session,started:body.started,source:choices(body.source,['meta','google','email','whatsapp','referral','direct','other'],'other'),device:choices(body.device,['mobile','desktop'],'desktop'),region:choices(body.region,['lisboa','margem_sul','other','unknown'],'unknown'),entry:choices(body.entry,['start','recovery','late'],'late'),events};
}
export async function storeFunnel(db, data, now=Date.now()) {
 const last=data.events.reduce((a,b)=>a.at>b.at?a:b);
 await db.batch([
  db.prepare(`INSERT INTO cleaning_funnel_sessions(id,started_at,last_seen,source,device,region,entry,last_stage) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=MAX(last_seen,excluded.last_seen),region=CASE WHEN excluded.region='unknown' THEN region ELSE excluded.region END,last_stage=CASE WHEN excluded.last_seen>=last_seen THEN excluded.last_stage ELSE last_stage END`).bind(data.id,data.started,last.at,data.source,data.device,data.region,data.entry,last.stage),
  ...data.events.map(e=>db.prepare('INSERT OR IGNORE INTO cleaning_funnel_events(session_id,seq,name,stage,detail,elapsed,at) VALUES(?,?,?,?,?,?,?)').bind(data.id,e.seq,e.name,e.stage,e.detail,e.elapsed,e.at))
 ]);
 // Limpeza limitada: nunca varrer o histórico completo em cada visita.
 if(data.events.some(e=>e.name==='page')){
  const expired=now-90*86400000;
  await db.batch([
   db.prepare('DELETE FROM cleaning_funnel_events WHERE session_id IN (SELECT id FROM cleaning_funnel_sessions WHERE last_seen<? ORDER BY last_seen,id LIMIT 50)').bind(expired),
   db.prepare('DELETE FROM cleaning_funnel_sessions WHERE id IN (SELECT id FROM cleaning_funnel_sessions WHERE last_seen<? ORDER BY last_seen,id LIMIT 50)').bind(expired)
  ]);
 }
}

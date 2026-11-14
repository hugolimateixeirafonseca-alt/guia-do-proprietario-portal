(() => {
 'use strict';
 const VERSION='2026-09-01-1', KEY='gp_cleaning_funnel_v1';
 let state=null,queue=[],timer=null,inflight=false,stage=1,entered=Date.now(),region='unknown',seq=0;
 const allowed=()=>{try{const raw=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('gp_cookie_preferences='));const p=JSON.parse(decodeURIComponent(raw?.slice(22)||''));const at=Date.parse(p.savedAt);return p.version===VERSION&&p.measurement===true&&at<=Date.now()+300000&&at>=Date.now()-15552000000;}catch{return false;}};
 function stop(){state=null;queue=[];clearTimeout(timer);timer=null;try{sessionStorage.removeItem(KEY);}catch{}}
 function persist(){try{sessionStorage.setItem(KEY,JSON.stringify({...state,seq,touched:Date.now()}));}catch{}}
 function source(){const p=new URLSearchParams(location.search),s=(p.get('utm_source')||'').toLowerCase();if(p.has('fbclid')||/^(facebook|instagram|fb|ig|meta)$/.test(s))return 'meta';if(p.has('gclid')||s==='google')return 'google';if(/^(email|sender|newsletter)$/.test(s))return 'email';if(s==='whatsapp')return 'whatsapp';if(s)return 'other';try{return document.referrer&&new URL(document.referrer).origin!==location.origin?'referral':'direct';}catch{return 'direct';}}
 function start(){
  if(!allowed()){stop();return false;}
  if(state)return true;
  try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');if(saved?.version===1&&saved.journey==='pedir-v1'&&saved.touched>Date.now()-1800000&&saved.started>Date.now()-86400000&&Number.isInteger(saved.seq)){state=saved;seq=saved.seq;}}catch{}
  if(!state){state={version:1,journey:'pedir-v1',session:crypto.randomUUID(),started:Date.now(),source:source(),device:innerWidth<768?'mobile':'desktop',entry:window.premiumResumeKey?'recovery':stage===1?'start':'late'};seq=0;}
  persist();return true;
 }
 function emit(name,detail='',elapsed=0){
  try{if(!start()||seq>=80)return;queue.push({seq:seq++,name,stage,detail,elapsed:Math.min(1800000,Math.max(0,Math.round(elapsed))),at:Date.now()});persist();if(!timer)timer=setTimeout(()=>flush(),5000);}catch{}
 }
 async function flush(closing=false){
  clearTimeout(timer);timer=null;if(!allowed()){stop();return;}if(!queue.length||(!closing&&inflight)||!state)return;
  const batch=queue.splice(0,20),payload=JSON.stringify({...state,region,events:batch});
  if(closing&&navigator.sendBeacon){if(navigator.sendBeacon('/api/cleaning-funnel',new Blob([payload],{type:'application/json'})))return;}
  inflight=true;
  try{const r=await fetch('/api/cleaning-funnel',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:true});if(!r.ok)queue.unshift(...batch);}catch{queue.unshift(...batch);}finally{inflight=false;queue=queue.slice(0,80);}
 }
 const fields={zone:'zone',frequency:'frequency',space:'space',size:'size',area:'area',days:'days',periods:'periods',contactName:'name',email:'email',phone:'phone',correctedPhone:'phone',postalCode:'postal',timing:'timing',preferredDate:'date',channels:'channels',allowContact:'permission',planOfInterest:'plan',other:'other'};
 window.gpCleaningFunnel={
  track:emit,
  step(next,zone){try{if(stage!==next){emit('leave','',Date.now()-entered);entered=Date.now();}stage=next;region=['Alcochete','Almada','Barreiro','Moita','Montijo','Palmela','Seixal','Sesimbra','Setúbal'].includes(zone)?'margem_sul':zone?'lisboa':'unknown';emit('step');}catch{}}
 };
 document.addEventListener('invalid',e=>emit('invalid',fields[e.target.name||e.target.id]||'other'),true);
 document.addEventListener('click',e=>{if(e.target.closest?.('#otherEntry')){emit('redirect','other_landing');flush(true);}if(e.target.closest?.('#edit-number'))emit('phone_edit');},true);
 window.addEventListener('error',e=>{if(e.target?.tagName==='SCRIPT')emit('script_error','resource');else if(e.filename?.includes('/limpeza-regular-lisboa-margem-sul/'))emit('script_error','script');},true);
 window.addEventListener('unhandledrejection',()=>emit('script_error','unhandled'));
 function consent(){if(allowed()){emit('page');emit('step');}else stop();}
 window.addEventListener('gp:measurement-choice',consent);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){emit('leave','',Date.now()-entered);flush(true);}else if(allowed()&&queue.length)flush();});
 window.addEventListener('pagehide',()=>{emit('leave','',Date.now()-entered);flush(true);});
 consent();
})();

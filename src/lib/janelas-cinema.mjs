import {trackerLink} from './tracker-link.mjs';
export const CINEMA_SOURCE='campanha-janelas-cinema';
export function cinemaLink(pageUrl,cookieString,firstSeenAt,visitId){
 const page=new URL(pageUrl);page.searchParams.set('source',CINEMA_SOURCE);
 const u=new URL(trackerLink({offer:'janelas-diagnostico',trackerOrigin:'https://track.guiadoproprietario.pt',pageUrl:page.href,cookieString,firstSeenAt}));
 if(u.searchParams.get('measurement_consent')==='true'&&/^PV_[a-f0-9]{32}$/.test(visitId||''))u.searchParams.set('visit_id',visitId);
 return u;
}
export function initCinema(doc,win){
 const root=doc.querySelector('#cinema');if(!root)return;
 const reduce=win.matchMedia('(prefers-reduced-motion: reduce)');let paused=reduce.matches,visitId=null,pending=null,attempted=false;
 const firstSeenAt=Date.now();const links=[...doc.querySelectorAll('[data-cinema-link]')];
 const current=()=>cinemaLink(win.location.href,doc.cookie,firstSeenAt,visitId);
 const updateLinks=()=>{const u=current();if(u.searchParams.get('measurement_consent')!=='true')visitId=null;links.forEach(a=>a.href=u.href)};
 const visit=()=>{updateLinks();const u=current();if(attempted||pending||u.searchParams.get('measurement_consent')!=='true')return;
  attempted=true;const body=new URLSearchParams();for(const k of ['measurement_consent','consent_version','consent_at'])body.set(k,u.searchParams.get(k));
  pending=win.fetch('https://track.guiadoproprietario.pt/visit/'+CINEMA_SOURCE,{method:'POST',body,credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(4000)}).then(r=>r.ok?r.json():null).then(v=>{if(/^PV_[a-f0-9]{32}$/.test(v?.visit_id||'')&&current().searchParams.get('measurement_consent')==='true')visitId=v.visit_id;updateLinks()}).catch(()=>{}).finally(()=>pending=null);
 };
 links.forEach(a=>{for(const e of ['click','auxclick','contextmenu','focus'])a.addEventListener(e,updateLinks)});visit();
 doc.addEventListener('click',e=>{if(e.target.closest('[data-cookie-choice], [data-cookie-save]'))win.setTimeout(visit,0)});
 const toggle=doc.querySelector('.motion-toggle');
 const applyMotion=()=>{root.classList.toggle('motion-paused',paused);root.classList.toggle('motion-ready',!paused);toggle.setAttribute('aria-pressed',String(paused));toggle.textContent=paused?'Ativar animações':'Pausar animações';};applyMotion();
 toggle.addEventListener('click',()=>{paused=!paused;applyMotion();paint()});reduce.addEventListener('change',()=>{paused=reduce.matches;applyMotion();paint()});
 const rain=doc.querySelector('#film-rain');for(let i=0;i<46;i++){const d=doc.createElement('i');d.style.left=((i*37)%100)+'%';d.style.animationDuration=(2.5+(i%7)*.7)+'s';d.style.animationDelay=(-i*.43)+'s';d.style.height=(20+i%5*12)+'px';rain.append(d)}
 let scheduled=false;const paint=()=>{scheduled=false;const y=win.scrollY,h=win.innerHeight;const p=Math.min(1,Math.max(0,(y/h-.12)/1.35));root.style.setProperty('--warm',p.toFixed(3));root.style.setProperty('--rain',(1-p).toFixed(3));root.style.setProperty('--zoom',paused?'1':(1+Math.min(y/h,2)*.035).toFixed(3));root.style.setProperty('--pan',paused?'0px':(-Math.min(y/h,2)*9)+'px');};
 win.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;win.requestAnimationFrame(paint)}},{passive:true});win.addEventListener('resize',paint);paint();
 const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.12});doc.querySelectorAll('.reveal').forEach(e=>observer.observe(e));
 const range=doc.querySelector('#ambiente-range'),comparison=doc.querySelector('.film-comparison');const split=()=>comparison.style.setProperty('--split',range.value+'%');range.addEventListener('input',split);doc.querySelectorAll('[data-atmosphere]').forEach(b=>b.addEventListener('click',()=>{range.value=b.dataset.atmosphere;split()}));
 let dragging=false;const drag=e=>{const box=comparison.getBoundingClientRect();range.value=String(Math.round(Math.max(0,Math.min(100,100*(1-(e.clientX-box.left)/box.width)))));split()};comparison.addEventListener('pointerdown',e=>{if(e.target===range)return;dragging=true;comparison.setPointerCapture(e.pointerId);drag(e)});comparison.addEventListener('pointermove',e=>{if(dragging)drag(e)});for(const event of ['pointerup','pointercancel','lostpointercapture'])comparison.addEventListener(event,()=>dragging=false);comparison.addEventListener('dragstart',e=>e.preventDefault());
 const form=doc.querySelector('#cinema-quiz'),steps=[...form.querySelectorAll('[data-step]')],progress=[...doc.querySelectorAll('.quiz-progress li')];let step=0;
 const show=n=>{step=n;steps.forEach((s,i)=>{s.hidden=i!==n;if(s.tagName==='FIELDSET')s.disabled=i!==n});progress.forEach((s,i)=>{if(i===n)s.setAttribute('aria-current','step');else s.removeAttribute('aria-current')});steps[n].querySelector('legend,h3')?.focus();};
 form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;if(step===1){const z=form.querySelector('[name=zona]:checked').value,j=form.querySelector('[name=janelas]:checked').value;doc.querySelector('#quiz-summary').textContent='A sua escolha: '+z+' · '+j+' janelas. Veja os detalhes da campanha e confirme a disponibilidade com o cliente.';}show(Math.min(2,step+1));});
 form.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>show(Math.max(0,step-1))));
}

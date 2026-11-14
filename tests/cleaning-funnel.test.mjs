import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validateFunnel,storeFunnel} from '../functions/lib/cleaning-funnel.mjs';
import {onRequestPost} from '../functions/api/cleaning-funnel.js';
const now=Date.now();
const cookie=(accepted=true)=>'gp_cookie_preferences='+encodeURIComponent(JSON.stringify({version:'2026-09-01-1',measurement:accepted,savedAt:new Date(now).toISOString()}));
const request=(value,accepted=true,origin='https://guiadoproprietario.pt')=>new Request('https://guiadoproprietario.pt/api/cleaning-funnel',{method:'POST',headers:{Origin:origin,Cookie:cookie(accepted),'Content-Type':'application/json'},body:JSON.stringify(value)});
function body(){return {version:1,journey:'pedir-v1',session:crypto.randomUUID(),started:now-1000,source:'meta',device:'mobile',region:'lisboa',entry:'start',events:[{seq:0,name:'page',stage:1,detail:'',elapsed:0,at:now-1000},{seq:1,name:'step',stage:2,detail:'',elapsed:0,at:now}]};}
function db(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/partner-email/0004_cleaning_funnel.sql',import.meta.url),'utf8'));return {sql,prepare(text){return {bind(...args){return {async run(){return sql.prepare(text).run(...args);}};}};},async batch(items){return Promise.all(items.map(x=>x.run()));}};}
test('consent, origin, event vocabulary and size are enforced before writes',async()=>{
 const b=body();assert.throws(()=>validateFunnel(b,request(b,false),now),/consent/);assert.throws(()=>validateFunnel(b,request(b,true,'https://other.test'),now),/origin/);
 b.events[0].detail='private@example.test';assert.throws(()=>validateFunnel(b,request(b),now),/event/);
 const r=await onRequestPost({request:request({...body(),padding:'x'.repeat(13000)}),env:{}});assert.equal(r.status,413);
});
test('only whitelisted metadata is retained and retried batches do not duplicate events',async()=>{
 const d=db(),b={...body(),email:'private@example.test',ip:'1.2.3.4'};b.events[0].value='SECRET';
 const clean=validateFunnel(b,request(b),now);assert(!JSON.stringify(clean).includes('SECRET'));assert(!JSON.stringify(clean).includes('private'));
 await storeFunnel(d,clean,now);await storeFunnel(d,clean,now);
 assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM cleaning_funnel_events').get().n,2);
 assert.equal(d.sql.prepare('SELECT last_stage FROM cleaning_funnel_sessions').get().last_stage,2);
 const next={...clean,events:[{seq:2,name:'step',stage:3,detail:'',elapsed:0,at:now+1},{seq:3,name:'step',stage:4,detail:'',elapsed:0,at:now+1}]};await storeFunnel(d,next,now+1);
 assert.equal(d.sql.prepare('SELECT last_stage FROM cleaning_funnel_sessions').get().last_stage,4);
 await storeFunnel(d,clean,now+2);assert.equal(d.sql.prepare('SELECT last_stage FROM cleaning_funnel_sessions').get().last_stage,4);
});
test('collector returns 204 on accepted write and fails closed without storage',async()=>{
 const b=body();assert.equal((await onRequestPost({request:request(b),env:{EMAIL_DELIVERY_DB:db()}})).status,204);
 assert.equal((await onRequestPost({request:request(b),env:{}})).status,503);
 assert.equal((await onRequestPost({request:request(b,false),env:{EMAIL_DELIVERY_DB:db()}})).status,400);
});
function browser(accepted){
 const handlers={},storage=new Map(),sent=[];
 const document={cookie:accepted===null?'':cookie(accepted),referrer:'',visibilityState:'visible',addEventListener:(n,f)=>handlers['doc:'+n]=f};
 const window={addEventListener:(n,f)=>handlers[n]=f};
 const context={window,document,Date,crypto,URL,URLSearchParams,Blob,innerWidth:390,location:{origin:'https://guiadoproprietario.pt',search:'?utm_source=facebook&utm_campaign=PRIVATE',pathname:'/pedir-limpeza/'},navigator:{sendBeacon:(url,blob)=>{sent.push({url,blob});return true;}},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>1,clearTimeout(){},fetch:async()=>{throw Error('unexpected');}};
 vm.runInNewContext(readFileSync(new URL('../public/limpeza-regular-lisboa-margem-sul/funil.js',import.meta.url),'utf8'),context);
 return {context,window,document,handlers,storage,sent};
}
test('no measurement identifier or network request before acceptance or after refusal',()=>{
 const b=browser(null);b.window.gpCleaningFunnel.step(4,'Lisboa');b.handlers.pagehide();assert.equal(b.storage.size,0);assert.equal(b.sent.length,0);
 b.document.cookie=cookie(true);b.handlers['gp:measurement-choice']();assert.equal(b.storage.size,1);
 b.document.cookie=cookie(false);b.window.gpCleaningFunnel.track('submit','premium');b.handlers.pagehide();assert.equal(b.storage.size,0);assert.equal(b.sent.length,0);
});
test('field contents, URL parameters and contact data never enter the browser payload',async()=>{
 const b=browser(true);b.window.gpCleaningFunnel.step(4,'Almada');b.handlers['doc:invalid']({target:{name:'email',value:'PRIVATE@example.test'}});b.window.gpCleaningFunnel.track('success','premium');b.handlers.pagehide();
 const payload=JSON.parse(await b.sent[0].blob.text());assert.equal(payload.region,'margem_sul');assert.equal(payload.source,'meta');assert.equal(payload.device,'mobile');assert(payload.events.some(e=>e.name==='success'));assert(payload.events.some(e=>e.name==='invalid'&&e.detail==='email'));assert(!JSON.stringify(payload).includes('PRIVATE'));
 assert.doesNotThrow(()=>validateFunnel(payload,request(payload),Date.now()));
});

async function submission(reply,trackerFails=false){
 const source=readFileSync(new URL('../public/limpeza-regular-lisboa-margem-sul/landing.js',import.meta.url),'utf8');
 const events=[],routes=[],nodes=new Map();
 const c={normal:true,sending:false,delivered:false,pendingPhone:'+351900000000',request:{consents:{partnerSharing:true},notes:'',other:'',space:'Apartamento'},homeTypes:['Apartamento'],recoveryKey:'',presentedPartners:new Set(),lastSubmission:null,normalRequestData:()=>({}),location:{origin:'https://guiadoproprietario.pt',pathname:'/pedir-limpeza/',search:''},crypto,CustomEvent,document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}},window:{gpCleaningFunnel:{track:(...args)=>{if(trackerFails)throw Error('analytics unavailable');events.push(args);}},dispatchEvent(){}},fetch:async()=>reply,go:r=>routes.push(r)};
 vm.createContext(c);vm.runInContext(source.split('\n')[1]+'\n'+source.slice(source.indexOf('async function sendRequest(){'),source.indexOf('function premiumConfirmation(')),c);
 await vm.runInContext('sendRequest()',c);return {c,events,routes};
}
test('a tracking failure cannot block a confirmed cleaning request',async()=>{
 const f=await submission({ok:true,status:200,json:async()=>({dashboardStored:true})},true);assert.equal(f.c.delivered,true);assert.deepEqual(f.routes,['concluido']);
});
test('a rejected request records a failure, never a conversion',async()=>{
 const f=await submission({ok:false,status:409,json:async()=>({})});assert.equal(f.c.delivered,false);assert(f.events.some(e=>e[0]==='failure'&&e[1]==='conflict'));assert(!f.events.some(e=>e[0]==='success'));
 const success=await submission({ok:true,status:200,json:async()=>({dashboardStored:true})});assert(success.events.some(e=>e[0]==='success'&&e[1]==='network'));
});

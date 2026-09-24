import test from 'node:test';import assert from 'node:assert/strict';import {syncLead,syncPartner,processSenderSync} from '../functions/lib/cleaning-sender-sync.mjs';
const lead={email:'test@example.test',nome:'Test',origem:'landing-servicos-limpeza',consentimento_marketing:1,consentimento_marketing_em:'2026-09-23'};
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers});
for(const consent of [0,1])test('creates only consented groups and confirms persisted subscriber '+consent,async()=>{let saved=null;const calls=[];const original=globalThis.fetch;globalThis.fetch=async(url,options)=>{calls.push([url,options]);if(options.method==='GET')return saved?response({data:saved}):response({},404);const body=JSON.parse(options.body);assert.equal(body.trigger_automation,false);saved={id:'sub',status:{email:'active'},subscriber_tags:body.groups.map(id=>({id}))};return response({data:saved},201);};try{const result=await syncLead({SENDER_API_TOKEN:'test'},{...lead,consentimento_marketing:consent});assert.equal(result.state,'synced');assert.deepEqual(saved.subscriber_tags.map(g=>g.id),consent?['bWv1LJ','egK8WG']:['bWv1LJ']);assert.equal(calls.length,3);}finally{globalThis.fetch=original;}});
test('already present has no writes, opt-out is preserved',async()=>{const original=globalThis.fetch;try{for(const status of ['active','unsubscribed','bounced']){globalThis.fetch=async(_,options)=>{assert.equal(options.method,'GET');return response({data:{id:'sub',status:{email:status},subscriber_tags:[{id:'bWv1LJ'},{id:'egK8WG'}]}});};assert.equal((await syncLead({SENDER_API_TOKEN:'x'},lead)).state,status==='active'?'synced':'suppressed');}}finally{globalThis.fetch=original;}});
test('partial previous success only adds missing newsletter and verifies it',async()=>{const original=globalThis.fetch;let groups=['bWv1LJ'],writes=0;globalThis.fetch=async(url,options)=>{if(options.method==='POST'){assert.ok(url.endsWith('/egK8WG'));assert.equal(JSON.parse(options.body).trigger_automation,false);writes++;groups.push('egK8WG');return response({});}return response({data:{id:'sub',status:{email:'active'},subscriber_tags:groups.map(id=>({id}))}});};try{assert.equal((await syncLead({SENDER_API_TOKEN:'x'},lead)).state,'synced');assert.equal(writes,1);}finally{globalThis.fetch=original;}});
test('429 respects provider delay; unavailable and ambiguous create are retryable',async()=>{const original=globalThis.fetch;try{globalThis.fetch=async()=>response({},429,{'Retry-After':'600'});await assert.rejects(()=>syncLead({SENDER_API_TOKEN:'x'},lead),e=>e.status===429&&e.retryMs===600000);let calls=0;globalThis.fetch=async()=>{if(!calls++)return response({},404);throw new Error('timeout');};await assert.rejects(()=>syncLead({SENDER_API_TOKEN:'x'},lead),/network/);}finally{globalThis.fetch=original;}});

test('partner creates only company group, preserves other groups and opt-outs',async()=>{
 const original=globalThis.fetch;
 try{for(const initial of [null,{id:'s',status:{email:'active'},subscriber_tags:[{id:'other'}]},{id:'s',status:{email:'unsubscribed'},subscriber_tags:[]}]){
 let saved=initial;const writes=[];globalThis.fetch=async(url,options)=>{if(options.method==='GET')return saved?response({data:saved}):response({},404);const body=JSON.parse(options.body);writes.push(body);assert.equal(body.trigger_automation,false);if(String(url).endsWith('/subscribers'))saved={id:'s',status:{email:'active'},subscriber_tags:body.groups.map(id=>({id}))};else{assert.ok(String(url).endsWith('/aOoGvG'));saved.subscriber_tags.push({id:'aOoGvG'});}return response({});};
 const result=await syncPartner({SENDER_API_TOKEN:'x'},{email:'company@example.test',nome:'Company'});
 {assert.equal(result.state,'synced');if(initial?.status.email==='unsubscribed')assert.equal(saved.status.email,'unsubscribed');assert.ok(saved.subscriber_tags.some(g=>g.id==='aOoGvG'));assert.equal(writes.length,1);if(initial?.status.email==='active')assert.ok(saved.subscriber_tags.some(g=>g.id==='other'));if(!initial) assert.deepEqual(writes[0].groups,['aOoGvG']);}
 }}finally{globalThis.fetch=original;}
});
test('periodic recovery processes partners when lead queue is empty',async()=>{
 const original=globalThis.fetch;let finished=false;
 globalThis.fetch=async(url,options)=>{if(String(url).includes('api.sender.net'))return response({data:{id:'s',status:{email:'active'},subscriber_tags:[{id:'aOoGvG'}]}});const body=JSON.parse(options.body);if(String(url).endsWith('/api/sender-sync'))return response({job:null});if(body.action==='claim')return response({job:{partner_id:'p',attempts:1,lease:'lease',partner:{email:'company@example.test',nome:'Company'}}});assert.equal(body.partner_id,'p');assert.equal(body.state,'synced');finished=true;return response({ok:true});};
 try{assert.equal((await processSenderSync({SENDER_API_TOKEN:'x',CLEANING_DASHBOARD_API_TOKEN:'x'})).state,'synced');assert.ok(finished);}finally{globalThis.fetch=original;}
});

test('429 diagnostics expose only counters and classification, never contact or provider body',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>response({message:'Too Many Requests secret@example.test'},429,{'Content-Type':'application/json','Retry-After':'600','X-RateLimit-Limit':'120','X-RateLimit-Remaining':'0'});
 try{await assert.rejects(()=>syncLead({SENDER_API_TOKEN:'private-key'},lead),e=>{
  assert.equal(e.diagnostics.limit,120);assert.equal(e.diagnostics.remaining,0);assert.equal(e.diagnostics.operation,'lookup');assert.equal(e.diagnostics.reason,'too_many_requests');
  assert.ok(!JSON.stringify(e.diagnostics).includes('secret@example'));assert.ok(!JSON.stringify(e.diagnostics).includes('private-key'));return true;
 });}finally{globalThis.fetch=original;}
});

test('admin optout cancels promotional and transactional email without changing groups or running automations',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push(options);if(options.method==='GET')return response({data:{id:'s',status:{email:'active'},subscriber_tags:[{id:'aOoGvG'}]}});assert.equal(options.method,'PATCH');assert.deepEqual(JSON.parse(options.body),{subscriber_status:'UNSUBSCRIBED',transactional_email_status:'UNSUBSCRIBED',trigger_automation:false});return response({success:true});};
 try{const result=await syncPartner({SENDER_API_TOKEN:'test'},{email:'partner@example.test',bloquear_email:1});assert.deepEqual(result,{state:'suppressed',code:'admin_optout_synced'});assert.equal(calls.length,2);}finally{globalThis.fetch=original;}
});
test('optout does not create missing subscribers; failed cancellations remain retryable',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>response({},404);assert.equal((await syncPartner({SENDER_API_TOKEN:'test'},{email:'partner@example.test',bloquear_email:1})).code,'admin_optout_no_profile');
 globalThis.fetch=async(url,options)=>options.method==='GET'?response({data:{id:'s',subscriber_tags:[]}}):response({},503);
 await assert.rejects(()=>syncPartner({SENDER_API_TOKEN:'test'},{email:'partner@example.test',bloquear_email:1}),/unsubscribe_503/);
 }finally{globalThis.fetch=original;}
});

import test from 'node:test';import assert from 'node:assert/strict';
import {syncPartnerNewsletter,processSenderSync,PARTNER_NEWSLETTER_GROUP_TITLE as title} from '../functions/lib/cleaning-sender-sync.mjs';
const group='news123',email='partner@example.test';
function mock({consent=true,initial=null,groupExists=true,flipAt=0}={}){
 const calls=[],writes=[];let saved=initial,policyReads=0,exists=groupExists;
 const fetch=async(url,options={})=>{url=String(url);calls.push(url);const b=options.body?JSON.parse(options.body):{};
 if(url.endsWith('/api/partner-sender-sync')){if(b.action==='newsletter_policy'){policyReads++;return Response.json({ok:true,newsletter:{email,consent:flipAt&&policyReads>=flipAt?false:consent,nome:'Partner'}});}if(b.action==='claim')return Response.json({job:{kind:'newsletter',email,lease:'lease',attempts:1,newsletter:{email}}});assert.equal(b.kind,'newsletter');assert.equal(b.email,email);return Response.json({ok:true});}
 if(url.includes('/groups?'))return Response.json({data:exists?[{id:group,title}]:[],meta:{last_page:1}});
 if(url.endsWith('/groups')&&options.method==='POST'){assert.deepEqual(b,{title});exists=true;writes.push(b);return Response.json({data:{id:group,title}},{status:201});}
 if(options.method==='GET')return saved?Response.json({data:saved}):Response.json({}, {status:404});
 writes.push(b);assert.equal(b.trigger_automation,false);assert.ok(!('transactional_email_status' in b));
 if(options.method==='DELETE'){saved.subscriber_tags=saved.subscriber_tags.filter(g=>g.id!==group);return Response.json({success:true});}
 if(url.endsWith('/subscribers'))saved={id:'s',status:{email:'active',temail:'active'},subscriber_tags:b.groups.map(id=>({id}))};
 else if(url.endsWith('/groups/'+group))saved.subscriber_tags.push({id:group});
 else if(b.subscriber_status)saved.status.email=b.subscriber_status.toLowerCase();else if(b.groups)saved.subscriber_tags=b.groups.map(id=>({id}));
 return Response.json({success:true});
 };
 return {fetch,calls,writes,get saved(){return saved;}};
}
const env={SENDER_API_TOKEN:'test',CLEANING_DASHBOARD_API_TOKEN:'test'};
test('new explicit consent creates a dedicated group and subscriber, without automations',async()=>{const m=mock({groupExists:false}),old=globalThis.fetch;globalThis.fetch=m.fetch;try{
 assert.equal((await syncPartnerNewsletter(env,{email})).code,'newsletter_subscribed');assert.deepEqual(m.saved.subscriber_tags,[{id:group}]);assert.equal(m.writes.length,2);
 }finally{globalThis.fetch=old;}});
test('absence of consent does not create group or subscriber',async()=>{const m=mock({consent:false,groupExists:false}),old=globalThis.fetch;globalThis.fetch=m.fetch;try{
 assert.equal((await syncPartnerNewsletter(env,{email})).code,'newsletter_not_requested');assert.equal(m.writes.length,0);
 }finally{globalThis.fetch=old;}});
test('withdrawal removes only the newsletter group and keeps transactional channels and all other groups',async()=>{const m=mock({consent:false,initial:{id:'s',status:{email:'active',temail:'active'},subscriber_tags:[{id:group},{id:'aOoGvG'},{id:'other'}]}}),old=globalThis.fetch;globalThis.fetch=m.fetch;try{
 assert.equal((await syncPartnerNewsletter(env,{email})).code,'newsletter_removed');assert.deepEqual(m.saved.subscriber_tags,[{id:'aOoGvG'},{id:'other'}]);assert.deepEqual(m.saved.status,{email:'active',temail:'active'});assert.equal(m.writes.length,1);
 }finally{globalThis.fetch=old;}});
for(const status of ['unsubscribed','bounced','spam_reported'])test('never reactivates Sender suppression '+status,async()=>{const m=mock({initial:{id:'s',status:{email:status,temail:'active'},subscriber_tags:[{id:'aOoGvG'}]}}),old=globalThis.fetch;globalThis.fetch=m.fetch;try{assert.equal((await syncPartnerNewsletter(env,{email})).state,'suppressed');assert.equal(m.writes.length,0);assert.equal(m.saved.status.email,status);}finally{globalThis.fetch=old;}});
test('withdrawal while the job was waiting is rechecked before subscriber creation',async()=>{const m=mock({flipAt:2}),old=globalThis.fetch;globalThis.fetch=m.fetch;try{assert.equal((await syncPartnerNewsletter(env,{email})).code,'newsletter_removed');assert.equal(m.writes.length,0);}finally{globalThis.fetch=old;}});
test('recovery advertises newsletter capability and acknowledges the dedicated job',async()=>{const m=mock({initial:{id:'s',status:{email:'active'},subscriber_tags:[{id:group}]}}),old=globalThis.fetch;globalThis.fetch=async(url,options)=>{if(String(url).endsWith('/api/partner-sender-sync')&&JSON.parse(options.body).action==='claim')assert.equal(JSON.parse(options.body).newsletter_version,1);return m.fetch(url,options);};try{assert.equal((await processSenderSync(env,true)).code,'newsletter_subscribed');}finally{globalThis.fetch=old;}});
test('rate limits remain retryable and preserve provider backoff',async()=>{const old=globalThis.fetch;globalThis.fetch=async(url)=>String(url).endsWith('/api/partner-sender-sync')?Response.json({ok:true,newsletter:{email,consent:true}}):Response.json({}, {status:429,headers:{'Retry-After':'600'}});try{await assert.rejects(()=>syncPartnerNewsletter(env,{email}),e=>e.status===429&&e.retryMs===600000);}finally{globalThis.fetch=old;}});

test('an SMS optout never changes an explicit email-newsletter choice or any SMS status',async()=>{const m=mock({initial:{id:'s',status:{email:'active',sms:'unsubscribed',temail:'active'},subscriber_tags:[{id:group}]}}),old=globalThis.fetch;globalThis.fetch=m.fetch;try{assert.equal((await syncPartnerNewsletter(env,{email})).state,'synced');assert.equal(m.saved.status.sms,'unsubscribed');assert.equal(m.writes.length,0);}finally{globalThis.fetch=old;}});

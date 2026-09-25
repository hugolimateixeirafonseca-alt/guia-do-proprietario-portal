import assert from 'node:assert/strict';
import test from 'node:test';
import {renderPartnerEngagementEmail} from '../functions/lib/partner-engagement-email.mjs';
import {onRequestPost} from '../functions/api/make/partner-engagement-notification.ts';
import {deliveryFixture} from './partner-email-fixture.mjs';

const base = {event_id:'engagement:first_contact_feedback:partner:assignment',event_type:'first_contact_feedback',partner_email:'partner@example.pt',partner_name:'Limpezas <Norte>',dashboard_url:'https://parceiros.guiadoproprietario.pt/?t=private#mine',data:{municipality:'Porto'}};
const cases = [
  ['shared_contact_acquired',{municipality:'Porto',client_phone:'+351 912345678'}],
  ['unused_free_contacts',{active_requests:2,free_contacts:4,localities:'Porto, Gaia'}],
  ['first_contact_feedback',{municipality:'Porto'}],
  ['free_contacts_exhausted',{}],
  ['lead_expiring',{municipality:'Porto',days_remaining:5}],
  ['inactive_buyer',{missed_requests:6}]
];
test('six approved templates use one CTA, plain-text alternative and escaped customer strings', () => {
  for (const [event_type,data] of cases) {
    const message=renderPartnerEngagementEmail({...base,event_type,data});
    assert.equal((message.html.match(/<a /g)||[]).length,1);
    assert.match(message.html,/Limpezas &lt;Norte&gt;/);
    assert.doesNotMatch(message.html,/<img|<script|<table/);
    assert.ok(message.text.includes('Guia do Proprietário'));
    assert.ok(message.subject.length > 10);
  }
  assert.match(renderPartnerEngagementEmail({...base,event_type:'shared_contact_acquired',data:cases[0][1]}).html,/href="tel:\+351912345678"/);
  assert.match(renderPartnerEngagementEmail({...base,event_type:'lead_expiring',data:cases[4][1]}).text,/dentro de 5 dias/);
});
test('rejects unsupported events, false scarcity, zero counts and unsafe links',()=>{
  for(const patch of [
    {event_type:'unknown'}, {dashboard_url:'javascript:alert(1)'}, {dashboard_url:'https://parceiros.guiadoproprietario.pt.evil.test/'},
    {event_type:'unused_free_contacts',data:{active_requests:0,free_contacts:4,localities:'Porto'}},
    {event_type:'lead_expiring',data:{municipality:'Porto',days_remaining:2}},
    {event_type:'shared_contact_acquired',data:{municipality:'Porto',client_phone:'javascript:alert(1)'}},
    {event_type:'inactive_buyer',data:{missed_requests:0}}
  ]) assert.throws(()=>renderPartnerEngagementEmail({...base,...patch}));
});
const secret='internal-test-secret';
const request=(payload=base,authorization=`Bearer ${secret}`)=>new Request('https://guiadoproprietario.pt/api/make/partner-engagement-notification',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(payload)});
const env=db=>({PARTNER_ENGAGEMENT_ENABLED:'true',MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,SENDER_API_TOKEN:'test-only',CLEANING_DASHBOARD_API_TOKEN:'test-only',EMAIL_DELIVERY_DB:db});
test('disabled flag and invalid auth never contact any service',async()=>{
  const original=globalThis.fetch; globalThis.fetch=()=>{throw new Error('unexpected request');};
  try {
    assert.equal((await onRequestPost({request:request(base,'Bearer invalid'),env:env()})).status,404);
    assert.equal((await onRequestPost({request:request(),env:{...env(),PARTNER_ENGAGEMENT_ENABLED:'false'}})).status,503);
  }finally{globalThis.fetch=original;}
});
test('rechecks preferences and event eligibility, suppresses stale events and fails closed',async()=>{
  const original=globalThis.fetch;
  try {
    for(const mode of ['optout','stale','unavailable','invalid']) {
      let sends=0;
      globalThis.fetch=async url=>{
        if(String(url).endsWith('/api/partner-email-policy'))return new Response(JSON.stringify({ok:true,allowed:mode!=='optout'}));
        if(String(url).endsWith('/api/partner-engagement-policy'))return new Response(mode==='invalid'?'{}':JSON.stringify({ok:true,allowed:false}),{status:mode==='unavailable'?503:200});
        sends++;return new Response('{}');
      };
      const fixture=deliveryFixture();try{
        const response=await onRequestPost({request:request(),env:env(fixture.binding)});
        assert.equal(response.status,['unavailable','invalid'].includes(mode)?503:200);
        assert.equal(sends,0);
      }finally{fixture.db.close();}
    }
  }finally{globalThis.fetch=original;}
});
test('duplicate event delivers once to its intended recipient; 502 is held for review',async()=>{
  const original=globalThis.fetch;const fixture=deliveryFixture();let sent=[],status=200;
  globalThis.fetch=async(url,init)=>{
    if(String(url).includes('/api/partner-'))return new Response(JSON.stringify({ok:true,allowed:true,event_type:base.event_type,partner_name:base.partner_name,data:base.data}));
    sent.push(JSON.parse(init.body));return new Response('{}',{status});
  };
  try {
    const config=env(fixture.binding);
    assert.equal((await onRequestPost({request:request(),env:config})).status,200);
    assert.equal((await onRequestPost({request:request(),env:config})).status,200);
    assert.equal(sent.length,1);assert.equal(sent[0].to.email,base.partner_email);
    assert.match(sent[0].text,/Como|Já conseguiu/);
    fixture.db.exec("DELETE FROM provider_cooldown WHERE provider='sender_request_gate'");status=502;
    const next={...base,event_id:'engagement:first_contact_feedback:partner:other'};
    assert.equal((await (await onRequestPost({request:request(next),env:config})).json()).state,'uncertain');
    assert.equal((await onRequestPost({request:request(next),env:config})).status,503);
    assert.equal(sent.length,2);
  }finally{globalThis.fetch=original;fixture.db.close();}
});

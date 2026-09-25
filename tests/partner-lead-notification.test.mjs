import {deliveryFixture} from "./partner-email-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { onRequestPost } from "../functions/api/make/partner-lead-notification.ts";

const secret = "make-secret-with-at-least-32-characters";

function request(body, authorization = `Bearer ${secret}`) {
  return new Request("https://guiadoproprietario.pt/api/make/partner-lead-notification", {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const payload = {
  event_id: "assignment-12345",
  partner_name: "Limpezas Norte",
  partner_email: "parceiro@example.pt",
  dashboard_url: "https://parceiros.guiadoproprietario.pt/?t=token-seguro-com-mais-de-trinta-e-dois-carateres",
  lead_title: "Limpeza regular",
  municipality: "Porto",
  lead_summary: "Apartamento T2 · Semanal · Manhã",
  expires_at: "2 de setembro, 18:00"
};

test('queued email replaces the old access link with the current link before sending',async()=>{
 const original=globalThis.fetch;let sent;
 const fresh='https://parceiros.guiadoproprietario.pt/?t=new-access-after-admin-reset-12345678';
 globalThis.fetch=async(url,init)=>{
  if(String(url).endsWith('/api/partner-email-policy')){assert.equal(JSON.parse(init.body).refresh_link,true);return Response.json({ok:true,allowed:true,dashboard_url:fresh});}
  sent=JSON.parse(init.body);return Response.json({ok:true});
 };
 const f=deliveryFixture();try{
  assert.equal((await onRequestPost({request:request(payload),env:{EMAIL_DELIVERY_DB:f.binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,CLEANING_DASHBOARD_API_TOKEN:'internal',SENDER_API_TOKEN:'test'}})).status,200);
  assert.ok(sent.html.includes(fresh));assert.ok(sent.text.includes(fresh));assert.ok(!sent.text.includes(payload.dashboard_url));
 }finally{globalThis.fetch=original;f.db.close();}
});

test("recusa chamadas sem o segredo do Make", async () => {
  const response = await onRequestPost({
    request: request(payload, "Bearer errado"),
    env: { EMAIL_DELIVERY_DB:deliveryFixture().binding, MAKE_PARTNER_NOTIFICATIONS_SECRET: secret, CLEANING_DASHBOARD_API_TOKEN:'internal',SENDER_API_TOKEN: "sender-token" }
  });
  assert.equal(response.status, 404);
});

test("envia o aviso transacional pelo Sender sem incluir dados pessoais do cliente", async () => {
  let sent;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if(String(url).endsWith('/api/partner-email-policy'))return new Response('{"ok":true,"allowed":true}');
    sent = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ success: true, emailId: "email-1" }), { status: 200 });
  };
  try {
    const response = await onRequestPost({
      request: request(payload),
      env: { EMAIL_DELIVERY_DB:deliveryFixture().binding, MAKE_PARTNER_NOTIFICATIONS_SECRET: secret, CLEANING_DASHBOARD_API_TOKEN:'internal',SENDER_API_TOKEN: "sender-token" }
    });
    assert.equal(response.status, 200);
    assert.equal(sent.url, "https://api.sender.net/v2/message/send");
    assert.equal(sent.body.to.email, payload.partner_email);
    assert.equal(sent.body.from.email, "geral@guiadoproprietario.pt");
    assert.match(sent.body.html, /Ver pedido no dashboard/);
    assert.doesNotMatch(sent.body.html, /telefone|email do cliente|nome do cliente/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("aceita apenas ligações do dashboard oficial", async () => {
  const response = await onRequestPost({
    request: request({ ...payload, dashboard_url: "https://example.com/roubo" }),
    env: { EMAIL_DELIVERY_DB:deliveryFixture().binding, MAKE_PARTNER_NOTIFICATIONS_SECRET: secret, CLEANING_DASHBOARD_API_TOKEN:'internal',SENDER_API_TOKEN: "sender-token" }
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_dashboard_url" });
});

test("boas-vindas incluem o acesso permanente e condições sem anunciar um pedido inexistente", async () => {
  let sent;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(_url,init)=>{if(String(_url).endsWith('/api/partner-email-policy'))return new Response('{"ok":true,"allowed":true}');if(init.body)sent=JSON.parse(init.body);return new Response('{}',{status:200});};
  try {
    const welcome={...payload,event_id:'welcome:12345678-1234-1234-1234-123456789abc',partner_name:'Empresa <teste>',expires_at:null};
    const response=await onRequestPost({request:request(welcome),env:{EMAIL_DELIVERY_DB:deliveryFixture().binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,CLEANING_DASHBOARD_API_TOKEN:'internal',SENDER_API_TOKEN:'sender-test'}});
    assert.equal(response.status,200);
    assert.match(sent.subject,/aprovada/);
    for(const body of [sent.html,sent.text]){
      assert.ok(body.includes(payload.dashboard_url));
      assert.match(body,/Entrar na minha área de parceiro/);
      assert.match(body,/quatro contactos são gratuitos/);
      assert.match(body,/4,50 €/);assert.match(body,/7 €/);assert.match(body,/sem limite diário/);assert.match(body,/Até mais 2 empresas podem receber o mesmo contacto/);assert.match(body,/só a sua empresa recebe os dados deste cliente através do Guia do Proprietário/);assert.doesNotMatch(body,/Contacto partilhado|para partilhar/);
      assert.doesNotMatch(body,/Tem um novo pedido|Pedido disponível até/);
    }
    assert.ok(sent.html.includes('Empresa &lt;teste&gt;'));
    assert.equal(sent.to.email,payload.partner_email);
  }finally{globalThis.fetch=originalFetch;}
});


test('candidatura pendente confirma aprovação necessária, sem link de acesso',async()=>{const original=globalThis.fetch;let sent;globalThis.fetch=async(_url,init)=>{if(String(_url).endsWith('/api/partner-email-policy'))return new Response('{"ok":true,"allowed":true}');if(init.body)sent=JSON.parse(init.body);return new Response('{}');};try{const r=await onRequestPost({request:request({...payload,event_id:'application:12345678-1234-1234-1234-123456789abc',dashboard_url:'https://parceiros.guiadoproprietario.pt/aderir'}),env:{EMAIL_DELIVERY_DB:deliveryFixture().binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,CLEANING_DASHBOARD_API_TOKEN:'internal',SENDER_API_TOKEN:'test'}});assert.equal(r.status,200);assert.match(sent.text,/sujeita a aprovação/);assert.doesNotMatch(sent.html,/Tem um novo pedido|Entrar na minha área|\?t=/);}finally{globalThis.fetch=original;}});
test('aviso de aprovação vai para o administrador designado',async()=>{const original=globalThis.fetch;let sent;globalThis.fetch=async(_url,init)=>{if(String(_url).endsWith('/api/partner-email-policy'))return new Response('{"ok":true,"allowed":true}');if(init.body)sent=JSON.parse(init.body);return new Response('{}');};try{const body={...payload,event_id:'application-admin:12345678-1234-1234-1234-123456789abc',partner_email:'hugo.lima.teixeira.fonseca@gmail.com',dashboard_url:'https://parceiros.guiadoproprietario.pt/admin'};const r=await onRequestPost({request:request(body),env:{EMAIL_DELIVERY_DB:deliveryFixture().binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,CLEANING_DASHBOARD_API_TOKEN:'internal',SENDER_API_TOKEN:'test'}});assert.equal(r.status,200);assert.equal(sent.to.email,body.partner_email);assert.match(sent.subject,/aprovação/);const denied=await onRequestPost({request:request({...body,partner_email:'other@example.pt'}),env:{EMAIL_DELIVERY_DB:deliveryFixture().binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,CLEANING_DASHBOARD_API_TOKEN:'internal',SENDER_API_TOKEN:'test'}});assert.equal(denied.status,400);}finally{globalThis.fetch=original;}});


test('application email survives unavailable group queue and never inserts administrator into group',async()=>{
 const original=globalThis.fetch;const errors=console.error;console.error=()=>{};const calls=[];
 globalThis.fetch=async(url,init)=>{if(String(url).endsWith('/api/partner-email-policy'))return new Response('{"ok":true,"allowed":true}');calls.push(String(url));return new Response('{}',{status:String(url).endsWith('/message/send')?200:503});};
 try{const r=await onRequestPost({request:request({...payload,event_id:'application:12345678-1234-1234-1234-123456789abc'}),env:{EMAIL_DELIVERY_DB:deliveryFixture().binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,CLEANING_DASHBOARD_API_TOKEN:'internal',SENDER_API_TOKEN:'test',CLEANING_DASHBOARD_API_TOKEN:'ingest'}});assert.equal(r.status,200);assert.ok(calls.some(c=>c.endsWith('/api/partner-sender-sync')));assert.ok(calls.some(c=>c.endsWith('/message/send')));assert.equal(calls.some(c=>c.includes('/subscribers')),false);}finally{globalThis.fetch=original;console.error=errors;}
});

test('repeated endpoint calls send only once and distinguish Sender rate limit from unknown response',async()=>{
 const original=globalThis.fetch;const f=deliveryFixture();const env={EMAIL_DELIVERY_DB:f.binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,CLEANING_DASHBOARD_API_TOKEN:'internal',SENDER_API_TOKEN:'test'};let calls=0,status=429;
 globalThis.fetch=async(url)=>{if(String(url).endsWith('/api/partner-email-policy'))return new Response('{"ok":true,"allowed":true}');calls++;return new Response('{}',{status});};
 try{let r=await onRequestPost({request:request(payload),env});assert.equal((await r.json()).error,'sender_rate_limited');await onRequestPost({request:request(payload),env});assert.equal(calls,1);f.db.exec('UPDATE email_delivery SET next_attempt=0; DELETE FROM provider_cooldown');status=200;assert.equal((await onRequestPost({request:request(payload),env})).status,200);await onRequestPost({request:request(payload),env});assert.equal(calls,2);status=502;const other={...payload,event_id:'other-event'};r=await onRequestPost({request:request(other),env});assert.equal((await r.json()).state,'uncertain');await onRequestPost({request:request(other),env});assert.equal(calls,3);}finally{globalThis.fetch=original;f.db.close();}
});

test('queued notifications respect optout; unavailable policy never sends',async()=>{
 const original=globalThis.fetch;
 try{for(const mode of ['blocked','unavailable','invalid']){
 let sends=0;globalThis.fetch=async(url)=>{if(String(url).endsWith('/api/partner-email-policy'))return new Response(mode==='blocked'?'{"ok":true,"allowed":false}':'{}',{status:mode==='unavailable'?503:200});sends++;return new Response('{}');};
 const f=deliveryFixture();try{
 const result=await onRequestPost({request:request(payload),env:{EMAIL_DELIVERY_DB:f.binding,MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,SENDER_API_TOKEN:'test',CLEANING_DASHBOARD_API_TOKEN:'internal'}});
 assert.equal(result.status,mode==='blocked'?200:503);if(mode==='blocked')assert.equal((await result.json()).suppressed,true);assert.equal(sends,0);
 }finally{f.db.close();}
 }}finally{globalThis.fetch=original;}
});

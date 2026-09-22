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

test("recusa chamadas sem o segredo do Make", async () => {
  const response = await onRequestPost({
    request: request(payload, "Bearer errado"),
    env: { MAKE_PARTNER_NOTIFICATIONS_SECRET: secret, SENDER_API_TOKEN: "sender-token" }
  });
  assert.equal(response.status, 404);
});

test("envia o aviso transacional pelo Sender sem incluir dados pessoais do cliente", async () => {
  let sent;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ success: true, emailId: "email-1" }), { status: 200 });
  };
  try {
    const response = await onRequestPost({
      request: request(payload),
      env: { MAKE_PARTNER_NOTIFICATIONS_SECRET: secret, SENDER_API_TOKEN: "sender-token" }
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
    env: { MAKE_PARTNER_NOTIFICATIONS_SECRET: secret, SENDER_API_TOKEN: "sender-token" }
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_dashboard_url" });
});

test("boas-vindas incluem o acesso permanente e condições sem anunciar um pedido inexistente", async () => {
  let sent;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(_url,init)=>{sent=JSON.parse(init.body);return new Response('{}',{status:200});};
  try {
    const welcome={...payload,event_id:'welcome:12345678-1234-1234-1234-123456789abc',partner_name:'Empresa <teste>',expires_at:null};
    const response=await onRequestPost({request:request(welcome),env:{MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,SENDER_API_TOKEN:'sender-test'}});
    assert.equal(response.status,200);
    assert.match(sent.subject,/aprovada/);
    for(const body of [sent.html,sent.text]){
      assert.ok(body.includes(payload.dashboard_url));
      assert.match(body,/Entrar na minha área de parceiro/);
      assert.match(body,/quatro contactos aceites são gratuitos/);
      assert.match(body,/primeiro a aceitar/);
      assert.doesNotMatch(body,/Tem um novo pedido|Pedido disponível até/);
    }
    assert.ok(sent.html.includes('Empresa &lt;teste&gt;'));
    assert.equal(sent.to.email,payload.partner_email);
  }finally{globalThis.fetch=originalFetch;}
});


test('candidatura pendente confirma aprovação necessária, sem link de acesso',async()=>{const original=globalThis.fetch;let sent;globalThis.fetch=async(_url,init)=>{sent=JSON.parse(init.body);return new Response('{}');};try{const r=await onRequestPost({request:request({...payload,event_id:'application:12345678-1234-1234-1234-123456789abc',dashboard_url:'https://parceiros.guiadoproprietario.pt/aderir'}),env:{MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,SENDER_API_TOKEN:'test'}});assert.equal(r.status,200);assert.match(sent.text,/sujeita a aprovação/);assert.doesNotMatch(sent.html,/Tem um novo pedido|Entrar na minha área|\?t=/);}finally{globalThis.fetch=original;}});
test('aviso de aprovação vai para o administrador designado',async()=>{const original=globalThis.fetch;let sent;globalThis.fetch=async(_url,init)=>{sent=JSON.parse(init.body);return new Response('{}');};try{const body={...payload,event_id:'application-admin:12345678-1234-1234-1234-123456789abc',partner_email:'hugo.lima.teixeira.fonseca@gmail.com',dashboard_url:'https://parceiros.guiadoproprietario.pt/admin'};const r=await onRequestPost({request:request(body),env:{MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,SENDER_API_TOKEN:'test'}});assert.equal(r.status,200);assert.equal(sent.to.email,body.partner_email);assert.match(sent.subject,/aprovação/);const denied=await onRequestPost({request:request({...body,partner_email:'other@example.pt'}),env:{MAKE_PARTNER_NOTIFICATIONS_SECRET:secret,SENDER_API_TOKEN:'test'}});assert.equal(denied.status,400);}finally{globalThis.fetch=original;}});

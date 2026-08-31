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

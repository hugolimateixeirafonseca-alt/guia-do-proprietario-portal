import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetaAttribution,
  hasMetaMeasurementConsent,
  sendMetaConversion
} from "../src/lib/meta-conversions.mjs";

const consentCookie = encodeURIComponent(JSON.stringify({
  version: "2026-09-01-1",
  necessary: true,
  measurement: true
}));

test("só reconhece a autorização explícita de medição", () => {
  const allowed = new Request("https://guiadoproprietario.pt/kit-estudante/", {
    headers: { Cookie: `gp_cookie_preferences=${consentCookie}` }
  });
  const denied = new Request("https://guiadoproprietario.pt/kit-estudante/", {
    headers: { Cookie: `gp_cookie_preferences=${encodeURIComponent(JSON.stringify({ measurement: false }))}` }
  });
  assert.equal(hasMetaMeasurementConsent(allowed), true);
  assert.equal(hasMetaMeasurementConsent(denied), false);
  const outdated = new Request("https://guiadoproprietario.pt/kit-estudante/", {
    headers: { Cookie: `gp_cookie_preferences=${encodeURIComponent(JSON.stringify({ version: "2026-08-05-1", measurement: true }))}` }
  });
  assert.equal(hasMetaMeasurementConsent(outdated), false);
});

test("a atribuição exclui origens externas e só conserva identificadores válidos", () => {
  const request = new Request("https://guiadoproprietario.pt/api/verificacao-anuncio/intake", {
    headers: {
      Cookie: `gp_cookie_preferences=${consentCookie}`,
      Referer: "https://site-externo.example/anuncio",
      "CF-Connecting-IP": "203.0.113.10",
      "User-Agent": "Browser de teste"
    }
  });
  assert.deepEqual(buildMetaAttribution(request, {
    fbp: "fb.1.1720000000000.123456789",
    fbc: "valor-inválido"
  }), {
    consent: true,
    fbp: "fb.1.1720000000000.123456789",
    fbc: "",
    eventSourceUrl: "https://guiadoproprietario.pt",
    clientIpAddress: "203.0.113.10",
    clientUserAgent: "Browser de teste"
  });
});

test("envia o email apenas como SHA-256 e mantém o token fora do URL", async () => {
  let requestedUrl = "";
  let payload;
  const result = await sendMetaConversion({
    accessToken: "segredo-meta",
    datasetId: "1394294186173855",
    graphVersion: "v25.0",
    eventName: "Purchase",
    eventId: "purchase-pi_123",
    eventSourceUrl: "https://guiadoproprietario.pt/verificacao/enviar/",
    email: "Pessoa@Exemplo.pt",
    externalId: "pedido-123",
    fbp: "fb.1.1720000000000.123456789",
    clientIpAddress: "203.0.113.10",
    clientUserAgent: "Browser de teste",
    customData: { currency: "EUR", value: 3.9 },
    fetchImpl: async (url, options) => {
      requestedUrl = String(url);
      payload = JSON.parse(options.body);
      return new Response(JSON.stringify({ events_received: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  assert.deepEqual(result, { sent: true, eventsReceived: 1 });
  assert.equal(requestedUrl.includes("segredo-meta"), false);
  assert.equal(payload.access_token, "segredo-meta");
  assert.match(payload.data[0].user_data.em[0], /^[a-f0-9]{64}$/);
  assert.notEqual(payload.data[0].user_data.em[0], "pessoa@exemplo.pt");
  assert.equal(JSON.stringify(payload).includes("Pessoa@Exemplo.pt"), false);
  assert.equal(payload.data[0].event_id, "purchase-pi_123");
  assert.deepEqual(payload.data[0].custom_data, { currency: "EUR", value: 3.9 });
});

test("não envia nada quando o segredo não está configurado", async () => {
  let called = false;
  const result = await sendMetaConversion({
    accessToken: "",
    eventName: "Lead",
    eventId: "lead-123",
    fetchImpl: async () => { called = true; return new Response(); }
  });
  assert.deepEqual(result, { sent: false, reason: "not_configured" });
  assert.equal(called, false);
});

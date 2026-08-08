import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

let onRequestPost;
let buildDirectory;
let calls;
const originalFetch = globalThis.fetch;

const env = {
  SENDER_API_TOKEN: "token-de-teste",
  SENDER_GROUP_MARKETING: "egK8WG",
  SENDER_GROUP_GUIA_VENDER_CASA: "dJAl59",
  SENDER_GROUP_GUIA_PARCEIROS: "aKBm4l"
};

const requestFor = (body) => new Request("https://guiadoproprietario.pt/api/subscribe", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "CF-Connecting-IP": "192.0.2.10"
  },
  body: JSON.stringify(body)
});

const ebookBody = {
  email: "Pessoa@Exemplo.pt",
  consent1: true,
  consent2: false,
  consentVersion: "2026-08-j",
  source: "ebook-vender-casa",
  pageUrl: "https://guiadoproprietario.pt/guias/vender-casa/",
  eventId: "evento-123"
};

before(async () => {
  buildDirectory = await mkdtemp(path.join(process.cwd(), ".tmp-subscribe-test-"));
  const outfile = path.join(buildDirectory, "subscribe.mjs");
  const compilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  };
  const consentSource = await readFile(path.resolve("src/data/consent.ts"), "utf8");
  const subscribeSource = await readFile(path.resolve("functions/api/subscribe.ts"), "utf8");
  const consentOutput = ts.transpileModule(consentSource, { compilerOptions }).outputText;
  const subscribeOutput = ts.transpileModule(subscribeSource, { compilerOptions }).outputText
    .replace('"../../src/data/consent"', '"./consent.mjs"');
  await Promise.all([
    writeFile(path.join(buildDirectory, "consent.mjs"), consentOutput, "utf8"),
    writeFile(outfile, subscribeOutput, "utf8")
  ]);
  ({ onRequestPost } = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`));
});

beforeEach(() => {
  calls = [];
});

after(async () => {
  globalThis.fetch = originalFetch;
  await rm(buildDirectory, { recursive: true, force: true });
});

test("recusa pedidos sem o consentimento obrigatório", async () => {
  globalThis.fetch = async () => {
    throw new Error("A API não deveria ser chamada");
  };
  const response = await onRequestPost({
    request: requestFor({ ...ebookBody, consent1: false }),
    env
  });
  assert.equal(response.status, 400);
});

test("mantém a recolha desligada quando falta o token", async () => {
  globalThis.fetch = async () => {
    throw new Error("A API não deveria ser chamada");
  };
  const response = await onRequestPost({
    request: requestFor(ebookBody),
    env: { ...env, SENDER_API_TOKEN: "" }
  });
  assert.equal(response.status, 503);
});

test("recusa versões anteriores ao consentimento que inclui o prazo de venda", async () => {
  globalThis.fetch = async () => {
    throw new Error("A API não deveria ser chamada");
  };
  const response = await onRequestPost({
    request: requestFor({ ...ebookBody, consentVersion: "2026-08-i" }),
    env
  });
  assert.equal(response.status, 400);
});

test("usa os grupos confirmados mesmo sem variáveis adicionais na Cloudflare", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const response = await onRequestPost({
    request: requestFor({
      ...ebookBody,
      source: "newsletter",
      consentVersion: "newsletter-2026-08-c"
    }),
    env: { SENDER_API_TOKEN: "token-de-teste" }
  });
  assert.equal(response.status, 200);
  assert.match(calls.at(-1).url, /subscribers\/groups\/egK8WG$/);
});

test("atualiza um subscritor e adiciona uma newsletter single opt-in ao grupo ativo", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const response = await onRequestPost({
    request: requestFor({
      ...ebookBody,
      source: "newsletter",
      consentVersion: "newsletter-2026-08-c"
    }),
    env
  });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].init.method, "PATCH");
  assert.match(calls[2].url, /subscribers\/groups\/egK8WG$/);
  assert.deepEqual(JSON.parse(calls[2].init.body), {
    subscribers: ["pessoa@exemplo.pt"],
    trigger_automation: false
  });
});

test("cria o pedido do guia sem autorização de parceiros e aciona a automação no fim", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const status = init.method === "GET" ? 404 : init.method === "POST" && String(url).endsWith("/subscribers") ? 201 : 200;
    return new Response("{}", { status, headers: { "Content-Type": "application/json" } });
  };

  const response = await onRequestPost({
    request: requestFor(ebookBody),
    env
  });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  const createBody = JSON.parse(calls[1].init.body);
  assert.equal(createBody.email, "pessoa@exemplo.pt");
  assert.equal(createBody.fields["{$CONSENT_PARCEIROS}"], "false");
  assert.equal(createBody.fields["{$LEAD_SOURCE}"], "ebook-vender-casa");
  assert.deepEqual(createBody.groups, ["egK8WG", "dJAl59"]);
  assert.equal(createBody.trigger_automation, true);
});

test("recusa o pedido de parceiros sem nome, telefone, código postal, prazo de venda ou autorização", async () => {
  globalThis.fetch = async () => {
    throw new Error("A API não deveria ser chamada");
  };

  const partnerBody = {
    ...ebookBody,
    source: "ebook-vender-casa-partner",
    name: "Marta Silva",
    phone: "912 345 678",
    postalCode: "1000-001",
    saleTimeline: "within_3_months"
  };

  const withoutConsent = await onRequestPost({
    request: requestFor(partnerBody),
    env
  });
  const withoutPhone = await onRequestPost({
    request: requestFor({ ...partnerBody, consent2: true, phone: "123" }),
    env
  });
  const withoutName = await onRequestPost({
    request: requestFor({ ...partnerBody, consent2: true, name: "" }),
    env
  });
  const invalidNameCharacter = await onRequestPost({
    request: requestFor({ ...partnerBody, consent2: true, name: "Marta@" }),
    env
  });
  const withoutPostalCode = await onRequestPost({
    request: requestFor({ ...partnerBody, consent2: true, postalCode: "1000" }),
    env
  });
  const withoutSaleTimeline = await onRequestPost({
    request: requestFor({ ...partnerBody, consent2: true, saleTimeline: "" }),
    env
  });

  assert.equal(withoutConsent.status, 400);
  assert.equal(withoutPhone.status, 400);
  assert.equal(withoutName.status, 400);
  assert.equal(invalidNameCharacter.status, 400);
  assert.equal(withoutPostalCode.status, 400);
  assert.equal(withoutSaleTimeline.status, 400);
  assert.deepEqual(await withoutConsent.json(), { error: "invalid_consent" });
  assert.deepEqual(await withoutPhone.json(), { error: "invalid_phone" });
  assert.deepEqual(await withoutName.json(), { error: "invalid_name" });
  assert.deepEqual(await invalidNameCharacter.json(), { error: "invalid_name" });
  assert.deepEqual(await withoutPostalCode.json(), { error: "invalid_postal_code" });
  assert.deepEqual(await withoutSaleTimeline.json(), { error: "invalid_sale_timeline" });
});

test("atualiza o contacto, guarda nome, telefone e localização e adiciona apenas o grupo de parceiros", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith("https://json.geoapi.pt/")) {
      return Response.json({ Localidade: "Lisboa", Concelho: "Lisboa" });
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const response = await onRequestPost({
    request: requestFor({
      ...ebookBody,
      source: "ebook-vender-casa-partner",
      name: "Marta Silva",
      phone: "+351 912 345 678",
      postalCode: "1000-001",
      saleTimeline: "3_to_12_months",
      consent2: true,
      eventId: "partner-123"
    }),
    env
  });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 5);
  const updateBody = JSON.parse(calls[2].init.body);
  assert.equal(updateBody.phone, "+351 912 345 678");
  assert.equal(updateBody.firstname, "Marta Silva");
  assert.equal(updateBody.fields["{$CONSENT_PARCEIROS}"], "true");
  assert.equal(updateBody.fields["{$LEAD_SOURCE}"], "ebook-vender-casa-partner");
  assert.equal(updateBody.fields["{$CODIGO_POSTAL}"], "1000-001");
  assert.equal(updateBody.fields["{$LOCALIDADE}"], "Lisboa");
  assert.equal(updateBody.fields["{$PRAZO_VENDA}"], "Entre 3 e 12 meses");
  assert.match(calls[3].url, /subscribers\/groups\/egK8WG$/);
  assert.match(calls[4].url, /subscribers\/groups\/aKBm4l$/);
  assert.equal(calls.some(({ url }) => url.endsWith("/dJAl59")), false);
  assert.deepEqual(await response.json(), { ok: true, locality: "Lisboa", locationStored: true });
});

test("recusa um código postal que o serviço identifica como inexistente", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } });
  };

  const response = await onRequestPost({
    request: requestFor({
      ...ebookBody,
      source: "ebook-vender-casa-partner",
      name: "Marta Silva",
      phone: "912 345 678",
      postalCode: "9999-999",
      saleTimeline: "undecided",
      consent2: true
    }),
    env
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "postal_not_found" });
  assert.equal(calls.length, 1);
});

test("não perde a lead se os campos de localização ainda não existirem no Sender", async () => {
  let senderWriteAttempts = 0;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith("https://json.geoapi.pt/")) {
      return Response.json({ Localidade: "Lisboa" });
    }
    if (init.method === "PATCH") {
      senderWriteAttempts += 1;
      return new Response("{}", { status: senderWriteAttempts === 1 ? 422 : 200 });
    }
    return new Response("{}", { status: 200 });
  };

  const response = await onRequestPost({
    request: requestFor({
      ...ebookBody,
      source: "ebook-vender-casa-partner",
      name: "Marta Silva",
      phone: "912 345 678",
      postalCode: "1000-001",
      saleTimeline: "value_only",
      consent2: true
    }),
    env
  });

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.locationStored, false);
  const fallbackBody = JSON.parse(calls[3].init.body);
  assert.equal("{$CODIGO_POSTAL}" in fallbackBody.fields, false);
  assert.equal("{$LOCALIDADE}" in fallbackBody.fields, false);
  assert.equal("{$PRAZO_VENDA}" in fallbackBody.fields, false);
});

test("cria uma subscrição nova da newsletter diretamente no grupo ativo", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const status = init.method === "GET" ? 404 : 201;
    return new Response("{}", { status, headers: { "Content-Type": "application/json" } });
  };

  const response = await onRequestPost({
    request: requestFor({
      ...ebookBody,
      source: "newsletter",
      consentVersion: "newsletter-2026-08-c"
    }),
    env
  });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  const createBody = JSON.parse(calls[1].init.body);
  assert.deepEqual(createBody.groups, ["egK8WG"]);
  assert.equal(createBody.trigger_automation, false);
});

test("não apresenta sucesso quando o Sender falha", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status: 401, headers: { "Content-Type": "application/json" } });
  };

  const response = await onRequestPost({ request: requestFor(ebookBody), env });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "provider_error", code: "lookup_401" });
});

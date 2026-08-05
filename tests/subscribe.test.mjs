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
  SENDER_GROUP_NEWSLETTER: "eEvG4m",
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
  consentVersion: "2026-08-e",
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

test("recusa versões anteriores que não incluem o novo âmbito das comunicações", async () => {
  globalThis.fetch = async () => {
    throw new Error("A API não deveria ser chamada");
  };
  const response = await onRequestPost({
    request: requestFor({ ...ebookBody, consentVersion: "2026-08-d" }),
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
  assert.match(calls.at(-1).url, /subscribers\/groups\/eEvG4m$/);
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
  assert.match(calls[2].url, /subscribers\/groups\/eEvG4m$/);
  assert.deepEqual(JSON.parse(calls[2].init.body), {
    subscribers: ["pessoa@exemplo.pt"],
    trigger_automation: false
  });
});

test("cria o pedido do guia, respeita parceiros e aciona a automação no fim", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const status = init.method === "GET" ? 404 : init.method === "POST" && String(url).endsWith("/subscribers") ? 201 : 200;
    return new Response("{}", { status, headers: { "Content-Type": "application/json" } });
  };

  const response = await onRequestPost({
    request: requestFor({ ...ebookBody, consent2: true }),
    env
  });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  const createBody = JSON.parse(calls[1].init.body);
  assert.equal(createBody.email, "pessoa@exemplo.pt");
  assert.equal(createBody.fields["{$CONSENT_PARCEIROS}"], "true");
  assert.equal(createBody.fields["{$LEAD_SOURCE}"], "ebook-vender-casa");
  assert.deepEqual(createBody.groups, ["eEvG4m", "aKBm4l", "dJAl59"]);
  assert.equal(createBody.trigger_automation, true);
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
  assert.deepEqual(createBody.groups, ["eEvG4m"]);
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

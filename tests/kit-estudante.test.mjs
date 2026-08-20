import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

let helper;
let buildDirectory;
let calls;
const originalFetch = globalThis.fetch;

before(async () => {
  buildDirectory = await mkdtemp(path.join(process.cwd(), ".tmp-kit-test-"));
  const source = await readFile(path.resolve("functions/lib/kit-estudante.ts"), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const outfile = path.join(buildDirectory, "kit-estudante.mjs");
  await writeFile(outfile, output, "utf8");
  helper = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
});

beforeEach(() => { calls = []; });

after(async () => {
  globalThis.fetch = originalFetch;
  await rm(buildDirectory, { recursive: true, force: true });
});

test("normaliza e valida o email sem alterar endereços válidos", () => {
  assert.equal(helper.normalizeEmail(" Pessoa@Exemplo.PT "), "pessoa@exemplo.pt");
  assert.equal(helper.isValidEmail("pessoa@exemplo.pt"), true);
  assert.equal(helper.isValidEmail("pessoa@"), false);
});

test("mantém allow-lists fechadas para cidade, fase e origem", () => {
  assert.equal(helper.ALLOWED_CITIES.has("evora"), true);
  assert.equal(helper.ALLOWED_CITIES.has("Évora"), false);
  assert.equal(helper.ALLOWED_PHASES.has("encontrou"), true);
  assert.equal(helper.ALLOWED_SOURCES.has("anuncio-inventado"), false);
});

test("cifra e recupera o email da sessão", async () => {
  const encrypted = await helper.encryptEmail("pessoa@exemplo.pt", "segredo-de-teste-comprido");
  assert.notEqual(encrypted, "pessoa@exemplo.pt");
  assert.equal(await helper.decryptEmail(encrypted, "segredo-de-teste-comprido"), "pessoa@exemplo.pt");
});

test("descobre o grupo pelo nome e cria o subscritor com a automação ativa", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/subscribers/pessoa%40exemplo.pt")) return new Response("{}", { status: 404 });
    if (String(url).includes("/groups?")) {
      return Response.json({ data: [{ id: "grupo123", title: "Kit Estudante Deslocado" }] });
    }
    if (String(url).endsWith("/subscribers") && init.method === "POST") {
      return Response.json({ data: { id: "contacto123" } });
    }
    throw new Error(`Pedido inesperado: ${url}`);
  };

  const result = await helper.createOrUpdateKitSubscriber(
    { SENDER_API_TOKEN: "token" },
    "pessoa@exemplo.pt",
    { "{$est_origem}": "direto" },
    true
  );
  assert.deepEqual(result, { created: true, contactId: "contacto123", inGroup: true });
  const createCall = calls.find((call) => call.url.endsWith("/subscribers") && call.init.method === "POST");
  const payload = JSON.parse(createCall.init.body);
  assert.deepEqual(payload.groups, ["grupo123"]);
  assert.equal(payload.fields["{$est_origem}"], "direto");
  assert.equal(payload.trigger_automation, true);
});

test("não marca um contacto existente para reiniciar a automação", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/subscribers/pessoa%40exemplo.pt") && init.method === "GET") {
      return Response.json({ data: { id: "contacto123", subscriber_tags: [{ id: "grupo123" }] } });
    }
    if (String(url).endsWith("/subscribers/pessoa%40exemplo.pt") && init.method === "PATCH") {
      return Response.json({ success: true });
    }
    throw new Error(`Pedido inesperado: ${url}`);
  };
  const result = await helper.createOrUpdateKitSubscriber(
    { SENDER_API_TOKEN: "token" },
    "pessoa@exemplo.pt",
    { "{$est_fase}": "tratado" },
    false
  );
  assert.equal(result.created, false);
  assert.equal(result.inGroup, true);
  const patchCall = calls.find((call) => call.init.method === "PATCH");
  assert.equal(JSON.parse(patchCall.init.body).trigger_automation, false);
});


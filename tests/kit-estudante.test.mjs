import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

let helper;
let buildDirectory;
let calls;
let thankYouSource;
let profileSource;
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
  thankYouSource = await readFile(path.resolve("src/pages/kit-estudante/obrigado.astro"), "utf8");
  profileSource = await readFile(path.resolve("functions/api/kit-estudante/perfil.ts"), "utf8");
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

test("o cookie de sessão chega aos endpoints da API sem expor o token", () => {
  const cookie = helper.sessionCookie("token-seguro");
  assert.match(cookie, /^gp_kit_session=token-seguro;/);
  assert.match(cookie, /Path=\//);
  assert.doesNotMatch(cookie, /Path=\/kit-estudante/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  const request = new Request("https://guiadoproprietario.pt/api/kit-estudante/session", {
    headers: { Cookie: "gp_kit_session=token-seguro" }
  });
  assert.equal(helper.cookieValue(request), "token-seguro");
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

test("cidade e fase atualizam o mesmo contacto sem reiniciar a automação", async () => {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (init.method === "GET") {
      return Response.json({ data: { id: "contacto123", subscriber_tags: [{ id: "grupo123" }] } });
    }
    if (init.method === "PATCH") return Response.json({ success: true });
    throw new Error(`Pedido inesperado: ${url}`);
  };

  await helper.createOrUpdateKitSubscriber(
    { SENDER_API_TOKEN: "token" },
    "mesmo-contacto@exemplo.pt",
    { "{$est_cidade}": "porto" },
    false
  );
  await helper.createOrUpdateKitSubscriber(
    { SENDER_API_TOKEN: "token" },
    "mesmo-contacto@exemplo.pt",
    { "{$est_fase}": "encontrou" },
    false
  );

  const patchCalls = calls.filter((call) => call.init.method === "PATCH");
  assert.equal(patchCalls.length, 2);
  assert.ok(patchCalls.every((call) => call.url.endsWith("/subscribers/mesmo-contacto%40exemplo.pt")));
  assert.equal(JSON.parse(patchCalls[0].init.body).fields["{$est_cidade}"], "porto");
  assert.equal(JSON.parse(patchCalls[1].init.body).fields["{$est_fase}"], "encontrou");
  assert.ok(patchCalls.every((call) => JSON.parse(call.init.body).trigger_automation === false));
});

test("mantém os modos de email e sessão separados e só mostra a partilha no fim", () => {
  assert.match(thankYouSource, /cities\.has\(params\.get\("cidade"\)/);
  assert.match(thankYouSource, /owners\.has\(params\.get\("proprietario"\)/);
  assert.match(thankYouSource, /result\.active \? showLandingMode\(\) : showNoSessionMode\(\)/);
  assert.match(thankYouSource, /showLandingMode[\s\S]*?sharePanel\.hidden = true/);
  assert.match(thankYouSource, /completeStep\.hidden = false;[\s\S]*?sharePanel\.hidden = false/);
  assert.match(thankYouSource, /completeLink\.hidden = phase !== "encontrou"/);
  assert.doesNotMatch(thankYouSource, /procurar-quarto-olx-grupos-facebook/);
});

test("o endpoint de perfil aceita apenas cidade e fase através da sessão", () => {
  assert.match(profileSource, /resolveSession\(request, db, config\.sessionSecret\)/);
  assert.match(profileSource, /field === "est_cidade"/);
  assert.match(profileSource, /field === "est_fase"/);
  assert.match(profileSource, /createOrUpdateKitSubscriber\(env, session\.email,[\s\S]*false\)/);
  assert.match(profileSource, /profile_city_updated/);
  assert.match(profileSource, /profile_phase_updated/);
});


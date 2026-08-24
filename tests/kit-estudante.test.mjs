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
let landingSource;
let kitLayoutSource;
let directDeployWorkflowSource;
let metaWebhookSource;
let metaFormCreatorSource;
let makeMetaLeadSource;
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
  landingSource = await readFile(path.resolve("src/pages/kit-estudante/index.astro"), "utf8");
  kitLayoutSource = await readFile(path.resolve("src/layouts/KitEstudanteLayout.astro"), "utf8");
  directDeployWorkflowSource = await readFile(path.resolve(".github/workflows/deploy-pages-functions-direct.yml"), "utf8");
  metaWebhookSource = await readFile(path.resolve("functions/api/meta/webhook.ts"), "utf8");
  metaFormCreatorSource = await readFile(path.resolve("functions/api/meta/create-kit-form.ts"), "utf8");
  makeMetaLeadSource = await readFile(path.resolve("functions/api/make/meta-kit-lead.ts"), "utf8");
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

test("reconhece apenas a resposta parental como lead qualificada", () => {
  assert.equal(helper.isQualifiedParentRelation("Sou pai, mãe ou encarregado de educação de um estudante do ensino superior"), true);
  assert.equal(helper.isQualifiedParentRelation("pai_mae_encarregado"), true);
  assert.equal(helper.isQualifiedParentRelation("Sou estudante"), false);
  assert.equal(helper.isQualifiedParentRelation("Outro"), false);
  assert.equal(helper.isQualifiedParentRelation(""), false);
});

test("o webhook Meta bloqueia não-pais antes de enviar para o Sender", () => {
  assert.match(metaWebhookSource, /isQualifiedParentRelation\(relation\)/);
  assert.match(metaWebhookSource, /meta_lead_disqualified/);
  assert.match(metaWebhookSource, /missing_relation/);
  assert.ok(
    metaWebhookSource.indexOf("isQualifiedParentRelation(relation)")
      < metaWebhookSource.indexOf("createOrUpdateKitSubscriber(env, email")
  );
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
      return Response.json({ data: {
        id: "contacto123",
        subscriber_tags: [{ id: "grupo123" }],
        columns: [{ id: "origem-id", title: "est_origem", type: "text", value: "direto" }]
      } });
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
  const patchPayload = JSON.parse(patchCall.init.body);
  assert.equal(patchPayload.trigger_automation, false);
  assert.deepEqual(patchPayload.fields, { "{$est_origem}": "direto", "{$est_fase}": "tratado" });
  assert.equal(calls.some((call) => call.url.includes("/fields?")), false);
});

test("um contacto novo mantém origem, Coimbra e tratado após cada PATCH", async () => {
  const fieldIds = new Map([
    ["{$est_origem}", "origem-id"],
    ["{$est_cidade}", "cidade-id"],
    ["{$est_fase}", "fase-id"]
  ]);
  let contactExists = false;
  let persistedFields = {};
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/subscribers/mesmo-contacto%40exemplo.pt") && init.method === "GET") {
      if (!contactExists) return new Response(null, { status: 404 });
      return Response.json({ data: {
        id: "contacto123",
        subscriber_tags: [{ id: "grupo123" }],
        columns: Object.entries(persistedFields).map(([fieldName, value]) => ({
          id: fieldIds.get(fieldName),
          title: fieldName.slice(2, -1),
          type: "text",
          value
        }))
      } });
    }
    if (String(url).endsWith("/subscribers") && init.method === "POST") {
      const payload = JSON.parse(init.body);
      contactExists = true;
      persistedFields = { ...payload.fields };
      return Response.json({ data: { id: "contacto123" } });
    }
    if (init.method === "PATCH") {
      const payload = JSON.parse(init.body);
      persistedFields = { ...payload.fields };
      return Response.json({ success: true });
    }
    throw new Error(`Pedido inesperado: ${url}`);
  };

  const env = { SENDER_API_TOKEN: "token", SENDER_GROUP_KIT_ESTUDANTE: "grupo123" };
  const verifyContact = async () => {
    const response = await globalThis.fetch("https://api.sender.net/v2/subscribers/mesmo-contacto%40exemplo.pt", { method: "GET" });
    const columns = (await response.json()).data.columns;
    return Object.fromEntries(columns.map((column) => [`{$${column.title}}`, column.value]));
  };

  await helper.createOrUpdateKitSubscriber(
    env,
    "mesmo-contacto@exemplo.pt",
    { "{$est_origem}": "direto" },
    true
  );
  assert.deepEqual(await verifyContact(), { "{$est_origem}": "direto" });

  await helper.createOrUpdateKitSubscriber(
    env,
    "mesmo-contacto@exemplo.pt",
    { "{$est_cidade}": "coimbra" },
    false
  );
  assert.deepEqual(await verifyContact(), {
    "{$est_origem}": "direto",
    "{$est_cidade}": "coimbra"
  });

  await helper.createOrUpdateKitSubscriber(
    env,
    "mesmo-contacto@exemplo.pt",
    { "{$est_fase}": "tratado" },
    false
  );
  assert.deepEqual(await verifyContact(), {
    "{$est_origem}": "direto",
    "{$est_cidade}": "coimbra",
    "{$est_fase}": "tratado"
  });

  const patchCalls = calls.filter((call) => call.init.method === "PATCH");
  assert.equal(patchCalls.length, 2);
  assert.ok(patchCalls.every((call) => call.url.endsWith("/subscribers/mesmo-contacto%40exemplo.pt")));
  assert.deepEqual(JSON.parse(patchCalls[0].init.body).fields, {
    "{$est_origem}": "direto",
    "{$est_cidade}": "coimbra"
  });
  assert.deepEqual(JSON.parse(patchCalls[1].init.body).fields, {
    "{$est_origem}": "direto",
    "{$est_cidade}": "coimbra",
    "{$est_fase}": "tratado"
  });
  assert.ok(patchCalls.every((call) => JSON.parse(call.init.body).trigger_automation === false));
  assert.equal(calls.some((call) => call.url.includes("/fields?")), false);
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

test("mantém o Meta Pixel na landing e nos builds diretos", () => {
  assert.match(kitLayoutSource, /import CookieConsent/);
  assert.match(kitLayoutSource, /<CookieConsent \/>/);
  assert.match(landingSource, /measurementAllowed\(\)/);
  assert.match(landingSource, /fbq\("track", "Lead", \{ content_name: "kit_estudante_2026" \}, \{ eventID: eventId \}\)/);
  assert.match(directDeployWorkflowSource, /deployment_configs\?\.production\?\.env_vars\?\.PUBLIC_META_PIXEL_ID\?\.value/);
  assert.match(directDeployWorkflowSource, /method: 'PATCH'/);
  assert.match(directDeployWorkflowSource, /PUBLIC_META_PIXEL_ID: \{ type: 'plain_text', value: fallbackPixelId \}/);
  assert.match(directDeployWorkflowSource, /PUBLIC_META_PIXEL_ID was not persisted in Pages production/);
  assert.match(directDeployWorkflowSource, /PUBLIC_META_PIXEL_ID is missing or invalid in Pages production/);
  assert.match(directDeployWorkflowSource, /test -n "\$PUBLIC_META_PIXEL_ID"/);
});

test("o endpoint de perfil aceita apenas cidade e fase através da sessão", () => {
  assert.match(profileSource, /resolveSession\(request, db, config\.sessionSecret\)/);
  assert.match(profileSource, /field === "est_cidade"/);
  assert.match(profileSource, /field === "est_fase"/);
  assert.match(profileSource, /createOrUpdateKitSubscriber\(env, session\.email,[\s\S]*false\)/);
  assert.match(profileSource, /profile_city_updated/);
  assert.match(profileSource, /profile_phase_updated/);
});



test("o criador Meta fica inerte sem segredo temporário e é idempotente", () => {
  assert.match(metaFormCreatorSource, /META_FORM_ADMIN_SECRET/);
  assert.match(metaFormCreatorSource, /return new Response\("Not Found"/);
  assert.match(metaFormCreatorSource, /listForms\(token, version\)/);
  assert.match(metaFormCreatorSource, /created: false/);
  assert.match(metaFormCreatorSource, /block_display_for_non_targeted_viewer: "true"/);
  assert.match(metaFormCreatorSource, /allow_organic_lead_retrieval: "false"/);
});

test("o formulário Meta usa as perguntas e o consentimento aprovados", () => {
  assert.match(metaFormCreatorSource, /relacao_estudante/);
  assert.match(metaFormCreatorSource, /Sou pai, mãe ou encarregado de educação de um estudante do ensino superior/);
  assert.match(metaFormCreatorSource, /Sou estudante/);
  assert.match(metaFormCreatorSource, /Em que cidade vai estudar o seu filho\/a\?/);
  assert.match(metaFormCreatorSource, /Em que fase está a procura de alojamento\?/);
  assert.match(metaFormCreatorSource, /Consentimento para comunicações por email/);
  assert.match(metaFormCreatorSource, /is_required: true/);
  assert.match(metaFormCreatorSource, /https:\/\/guiadoproprietario\.pt\/privacidade\//);
});


test("o endpoint Make bloqueia não-pais antes do Sender", () => {
  assert.match(makeMetaLeadSource, /MAKE_META_LEADS_SECRET/);
  assert.match(makeMetaLeadSource, /isQualifiedParentRelation\(relation\)/);
  assert.match(makeMetaLeadSource, /make_meta_lead_disqualified/);
  assert.ok(
    makeMetaLeadSource.indexOf("isQualifiedParentRelation(relation)")
      < makeMetaLeadSource.indexOf("createOrUpdateKitSubscriber(env, email")
  );
});

test("o endpoint Make deduplica por leadgen_id e grava campos do Kit", () => {
  assert.match(makeMetaLeadSource, /missing_leadgen_id/);
  assert.match(makeMetaLeadSource, /make_meta_lead_fetched/);
  assert.match(makeMetaLeadSource, /\{\$est_origem\}: "meta"/);
  assert.match(makeMetaLeadSource, /\{\$est_relacao\}: "pai_mae_encarregado"/);
  assert.match(makeMetaLeadSource, /\{\$est_cidade\}/);
  assert.match(makeMetaLeadSource, /\{\$est_fase\}/);
  assert.match(makeMetaLeadSource, /consent_required/);
});

import assert from "node:assert/strict";
import { before, beforeEach, after, afterEach, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

let handler, buildDirectory, sql, calls, env;
const originalFetch = globalThis.fetch;
const body = { email: "Pessoa@example.com", consent1: true, consent2: false,
  consentVersion: "kit-janelas-2026-09-a", source: "kit-trocar-janelas",
  eventId: "e2c4c975-2c92-4198-865f-cd5c1d32f5d8", company: "" };
const requestFor = (value = body, extra = {}) => new Request("https://guiadoproprietario.pt/api/kit-trocar-janelas", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "https://guiadoproprietario.pt",
    "CF-Connecting-IP": "192.0.2.10", ...extra }, body: JSON.stringify(value)
});
before(async () => {
  const { build } = await import(process.env.KIT_TEST_ESBUILD || "esbuild");
  buildDirectory = await mkdtemp(path.join(process.env.KIT_TEST_TMPDIR || os.tmpdir(), "kit-janelas-test-"));
  const outfile = path.join(buildDirectory, "endpoint.mjs");
  await build({ entryPoints: [path.resolve("functions/api/kit-trocar-janelas.ts")], outfile,
    bundle: true, platform: "node", format: "esm", tsconfigRaw: { compilerOptions: {} } });
  handler = (await import(pathToFileURL(outfile).href)).onRequestPost;
});
beforeEach(async () => {
  sql = new DatabaseSync(":memory:");
  sql.exec(await readFile("migrations/0001_kit_estudante.sql", "utf8"));
  calls = [];
  const db = { prepare(query) { let values=[];return {
    bind(...args){values=args;return this},
    async first(){return sql.prepare(query).get(...values)||null},
    async run(){sql.prepare(query).run(...values);return {success:true}}
  }}};
  env = { KIT_ESTUDANTE_DB: db, SESSION_SECRET: "local-test-secret-with-no-production-access",
    SENDER_API_TOKEN: "fake-token", SENDER_GROUP_MARKETING: "marketing-only" };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({url:String(url),method:init.method,body:init.body?JSON.parse(init.body):null});
    if(init.method==="GET") return new Response("{}",{status:404});
    return Response.json({success:true});
  };
});
afterEach(()=>sql.close());
after(async()=>{
  globalThis.fetch=originalFetch;
  if(buildDirectory && path.basename(buildDirectory).startsWith("kit-janelas-test-")) await rm(buildDirectory,{recursive:true,force:true});
});
const call = (data=body, headers) => handler({request:requestFor(data,headers),env});

test("o envio exige o primeiro consentimento e a versão atual",async()=>{
  for(const change of [{consent1:false},{consent1:"true"},{consentVersion:"antiga"},{source:"outro"},{consent2:"true"}]){
    assert.equal((await call({...body,...change})).status,400);
  }
  assert.equal(calls.length,0);
});
test("envia o PDF sem inscrever quem deixa a segunda caixa vazia",async()=>{
  assert.equal((await call()).status,200);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,"https://api.sender.net/v2/message/send");
  assert.equal(calls[0].body.to.email,"pessoa@example.com");
  assert.equal(calls[0].body.attachments["Trocar-Janelas-2026.pdf"],"https://guiadoproprietario.pt/downloads/kit-trocar-janelas-2026.pdf");
  assert.ok(!calls[0].body.groups);
  const audit=sql.prepare("SELECT * FROM kit_events WHERE event='janelas_pdf_requested'").get();
  assert.deepEqual(JSON.parse(audit.field_value),{delivery:true,marketing:false});
  assert.equal(audit.consent_version,body.consentVersion);
  assert.ok(!JSON.stringify(sql.prepare("SELECT * FROM kit_events").all()).includes("pessoa@example.com"));
});
test("a segunda escolha inscreve só no grupo comercial e mantém consentimentos separados",async()=>{
  assert.equal((await call({...body,consent2:true})).status,200);
  const created=calls.find(c=>c.url.endsWith("/subscribers")&&c.method==="POST").body;
  assert.deepEqual(created.groups,["marketing-only"]);
  assert.equal(created.fields["{$CONSENT_MARKETING}"],"true");
  assert.equal(created.fields["{$CONSENT_PUBLICIDADE}"],"true");
  assert.equal(created.fields["{$CONSENT_PARCEIROS}"],undefined);
  assert.equal(created.trigger_automation,false);
  assert.equal(calls.filter(c=>c.url.endsWith("/message/send")).length,1);
});
test("um subscritor existente mantém os outros grupos e não dispara automações de outros kits",async()=>{
  globalThis.fetch=async(url,init={})=>{calls.push({url:String(url),method:init.method,body:init.body?JSON.parse(init.body):null});return Response.json({data:{id:"existing",groups:[{id:"old-kit"}]}})};
  assert.equal((await call({...body,consent2:true})).status,200);
  const patched=calls.find(c=>c.method==="PATCH").body;
  assert.equal(patched.groups,undefined);
  assert.equal(patched.trigger_automation,false);
  assert.ok(!calls.some(c=>c.method==="DELETE"));
});
test("repetir um pedido já concluído não volta a enviar o email",async()=>{
  await call();await call();
  assert.equal(calls.filter(c=>c.url.endsWith("/message/send")).length,1);
});
test("falha do fornecedor não é apresentada como sucesso e permite repetir",async()=>{
  globalThis.fetch=async()=>new Response("{}",{status:503});
  assert.equal((await call()).status,502);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM kit_events WHERE event='janelas_pdf_sent'").get().n,0);
  globalThis.fetch=async()=>Response.json({success:true});
  assert.equal((await call()).status,200);
});
test("falha na inscrição comercial é explícita e não comunica uma entrega inexistente",async()=>{
  globalThis.fetch=async(url,init={})=>new Response("{}",{status:init.method==="GET"?404:503});
  assert.equal((await call({...body,consent2:true})).status,502);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM kit_events WHERE event='janelas_pdf_sent'").get().n,0);
});
test("bloqueia origem externa, honeypot e email inválido antes de contactar o fornecedor",async()=>{
  assert.equal((await call(body,{Origin:"https://example.net"})).status,403);
  for(const change of [{company:"bot"},{email:"invalido"},{eventId:"abc"}]) assert.equal((await call({...body,...change})).status,400);
  assert.equal(calls.length,0);
});
test("sem configuração, a recolha falha de forma segura",async()=>{
  delete env.SENDER_API_TOKEN;
  assert.equal((await call()).status,503);assert.equal(calls.length,0);
});
test("limita reenvios para o mesmo destinatário",async()=>{
  for(let i=0;i<3;i++)assert.equal((await call({...body,eventId:crypto.randomUUID()})).status,200);
  assert.equal((await call({...body,eventId:crypto.randomUUID()})).status,429);
  assert.equal(calls.filter(c=>c.url.endsWith("/message/send")).length,3);
});
test("a página tem duas caixas vazias; só a primeira é obrigatória e não mostra opcional",async()=>{
  const page=await readFile("src/pages/kit-trocar-janelas/index.astro","utf8");
  assert.match(page,/name="consent_pdf"[^>]*required/);
  assert.match(page,/name="consent_marketing" type="checkbox" \/>/);
  assert.doesNotMatch(page,/opcional|checked=/i);
  assert.ok(!page.includes('href="/downloads/'));
});

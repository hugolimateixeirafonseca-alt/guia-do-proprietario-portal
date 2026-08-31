import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../../src/pages/verificacao-anuncio/index.astro", import.meta.url);
const uploadPagePath = new URL("../../src/pages/verificacao/enviar.astro", import.meta.url);
const uploadRedirectPath = new URL("../../functions/verificacao/enviar/[token].ts", import.meta.url);
const retryEndpointPath = new URL("../../functions/api/verificacao-anuncio/retry.ts", import.meta.url);

test("a landing apresenta a pré-verificação antes do pagamento e o relatório", async () => {
  const source = await readFile(pagePath, "utf8");
  assert.match(source, /data-demo-form/u);
  assert.match(source, /data-results/u);
  assert.match(source, /Não transfira a caução/u);
  assert.match(source, /Antes 7,90 €/u);
  assert.match(source, /3,90 €/u);
  assert.match(source, /poupa 4,00 €/iu);
  assert.doesNotMatch(source, /7,99 €|11,99 €/u);
  assert.match(source, /Analisar as minhas capturas grátis/u);
  assert.match(source, /Análise real sem pagamento inicial/u);
  assert.match(source, /Enviar capturas grátis/u);
  assert.match(source, /não são enviados para análise/u);
  assert.match(source, /\.section-heading\s*\{[\s\S]*?max-width:\s*none/u);
  assert.match(source, /Leitura inteligente das fotografias/u);
  assert.match(source, /O que as fotografias revelam/u);
  assert.doesNotMatch(source, /pesquisa inversa|fotografias noutros sites|correspondência pública/iu);
  assert.match(source, /Comparação do preço na cidade/u);
  assert.match(source, /capturas de ecrã \(screenshot\) do anúncio/iu);
  assert.doesNotMatch(source, /printscreen/iu);
  assert.match(source, /Pré-verificação sem custo/u);
  assert.match(source, /A pré-verificação gratuita está ativa/u);
  assert.match(source, /files\.length >= 1/u);
  assert.doesNotMatch(source, /files\.length < 4/u);
  assert.match(source, /Sistema inteligente com IA/u);
  assert.match(source, /Normalmente pronta em poucos minutos/u);
  assert.match(source, /\/verificacao\/enviar\//u);
  assert.doesNotMatch(source, /data-checkout-button/u);
  assert.match(source, /PUBLIC_VERIFICACAO_CHECKOUT_ENABLED/u);
  assert.doesNotMatch(source, /\/api\/verificacao-anuncio\/checkout/u);
});

test("a confirmação de pagamento não é indexada nem expõe o token privado", async () => {
  const source = await readFile(new URL("../../src/pages/verificacao/confirmacao.astro", import.meta.url), "utf8");
  assert.match(source, /noindex/u);
  assert.doesNotMatch(source, /access_token|accessToken|\?t=/u);
  assert.match(source, /email/u);
});

test("a página privada liga o envio real ao estado do pedido", async () => {
  const source = await readFile(uploadPagePath, "utf8");
  assert.match(source, /robots="noindex,nofollow"/u);
  assert.match(source, /Capturas de ecrã \(screenshot\)/u);
  assert.match(source, /\/api\/verificacao-anuncio\/status\?t=/u);
  assert.match(source, /\/api\/verificacao-anuncio\/upload\?t=/u);
  assert.match(source, /\/api\/verificacao-anuncio\/retry\?t=/u);
  assert.match(source, /confirmacao_privacidade/u);
  assert.match(source, /Fazer pré-verificação gratuita com IA/u);
  assert.match(source, /Windows \+ Shift \+ S/u);
  assert.match(source, /Android/u);
  assert.match(source, /iPhone/u);
  assert.match(source, /data-teaser/u);
  assert.match(source, /<s>7,90 €<\/s> 3,90 €/u);
  assert.doesNotMatch(source, /7,99 €|11,99 €/u);
  assert.match(source, /Primeiro as capturas\. Só depois o pagamento/u);
  const intakeScript = await readFile(new URL("../../public/scripts/verificacao-intake.js", import.meta.url), "utf8");
  assert.match(intakeScript, /\/api\/verificacao-anuncio\/intake/u);
  assert.match(intakeScript, /\/api\/verificacao-anuncio\/checkout/u);
  assert.match(intakeScript, /refresh\(\);\s*formStatus\.textContent = messages\[code\]/u);
  assert.match(intakeScript, /formStatus\.classList\.add\("is-error"\)/u);
  assert.match(source, /\.form-status\.is-error/u);
  assert.match(source, /\[hidden\]\)\{display:none!important\}/u);
  assert.doesNotMatch(source, /printscreen/iu);
});

test("o link do email transporta o token no caminho e redireciona para a página privada", async () => {
  const source = await readFile(uploadRedirectPath, "utf8");
  assert.match(source, /validateAccessToken/u);
  assert.match(source, /\/verificacao\/enviar\//u);
  assert.match(source, /searchParams\.set\("t", token\)/u);
  assert.match(source, /no-store/u);
});

test("a pré-verificação pública fica ativa sem ligar o checkout", async () => {
  const wrangler = await readFile(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../../.github/workflows/deploy-pages-functions-direct.yml", import.meta.url), "utf8");
  assert.match(wrangler, /"VERIFICACAO_PUBLIC_INTAKE_ENABLED": "true"/u);
  assert.match(workflow, /VERIFICACAO_PUBLIC_INTAKE_ENABLED: \{ type: 'plain_text', value: 'true' \}/u);
  assert.doesNotMatch(wrangler, /PUBLIC_VERIFICACAO_CHECKOUT_ENABLED[^\n]*true/u);
});

test("a recuperação tem um limite próprio e não colide com a consulta de estado", async () => {
  const source = await readFile(retryEndpointPath, "utf8");
  assert.match(source, /`\$\{config\.secret\}:retry`/u);
  assert.match(source, /analise_recuperacao_solicitada/u);
});

test("o relatório visual contém exatamente as 12 verificações", async () => {
  const source = await readFile(pagePath, "utf8");
  const reportBlock = source.match(/const reportChecks = \[([\s\S]*?)\n\];/u)?.[1] ?? "";
  assert.equal([...reportBlock.matchAll(/\{ id: \d+/gu)].length, 12);
  assert.equal(reportBlock.includes("—"), false);
  assert.equal(reportBlock.includes("–"), false);
});

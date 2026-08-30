import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../../src/pages/verificacao-anuncio/index.astro", import.meta.url);
const uploadPagePath = new URL("../../src/pages/verificacao/enviar.astro", import.meta.url);
const uploadRedirectPath = new URL("../../functions/verificacao/enviar/[token].ts", import.meta.url);
const retryEndpointPath = new URL("../../functions/api/verificacao-anuncio/retry.ts", import.meta.url);

test("a landing apresenta upload, relatório e checkout protegido por configuração pública", async () => {
  const source = await readFile(pagePath, "utf8");
  assert.match(source, /data-demo-form/u);
  assert.match(source, /data-results/u);
  assert.match(source, /Não transfira a caução/u);
  assert.match(source, /Antes 11,99 €/u);
  assert.match(source, /Comprar análise por 7,99 €/u);
  assert.match(source, /Pesquisa de fotografias noutros sites/u);
  assert.match(source, /Comparação do preço na cidade/u);
  assert.match(source, /capturas de ecrã \(screenshot\) do anúncio/iu);
  assert.doesNotMatch(source, /printscreen/iu);
  assert.match(source, /Compra disponível na próxima fase/u);
  assert.match(source, /Pagamento e análise ainda não estão ativos/u);
  assert.match(source, /files\.length >= 1/u);
  assert.doesNotMatch(source, /files\.length < 4/u);
  assert.match(source, /data-checkout-button/u);
  assert.match(source, /PUBLIC_VERIFICACAO_CHECKOUT_ENABLED/u);
  assert.match(source, /\/api\/verificacao-anuncio\/checkout/u);
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

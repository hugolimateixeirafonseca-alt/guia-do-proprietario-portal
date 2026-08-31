import assert from "node:assert/strict";
import test from "node:test";
import { buildPrecheckTeaser } from "../../src/lib/verificacao-anuncio/precheck.mjs";

test("o teaser confirma utilidade sem oferecer a investigação completa", () => {
  const teaser = buildPrecheckTeaser({
    factos: [
      { campo: "cidade", presente: true, valor: "Lisboa" },
      { campo: "preco_mensal", presente: true, valor: "900 €" },
      { campo: "caucao", presente: true, valor: "900 €" }
    ],
    regioes_fotografias: [{}, {}, {}]
  }, 4);
  assert.equal(teaser.useful, true);
  assert.equal(teaser.factCount, 3);
  assert.equal(teaser.photoCount, 3);
  assert.match(teaser.signal, /condições de pagamento/u);
  assert.doesNotMatch(JSON.stringify(teaser), /Lisboa|900/u);
});

test("o teaser pede melhores capturas quando não encontra material útil", () => {
  const teaser = buildPrecheckTeaser({ factos: [], regioes_fotografias: [] }, 1);
  assert.equal(teaser.useful, false);
  assert.match(teaser.headline, /mais informação visível/u);
});

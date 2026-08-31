import assert from "node:assert/strict";
import test from "node:test";
import { createAnalysisEngine } from "../../src/lib/verificacao-anuncio/engine.mjs";
import { classification, extraction } from "./fixtures.mjs";

const images = Array.from({ length: 4 }, (_, index) => ({ id: `upload-${index + 1}` }));

const dependencies = (overrides = {}) => ({
  extractor: { extract: async () => extraction() },
  priceReferenceProvider: { lookup: async () => null },
  classifier: { classify: async () => classification() },
  ...overrides
});

test("o motor produz 12 verificações e ações apenas nos itens por confirmar", async () => {
  const result = await createAnalysisEngine(dependencies()).analyze({ images, city: "Porto" });
  assert.equal(result.report.totalCount, 12);
  assert.equal(result.report.nextActions.length, 12);
  assert.equal(result.report.visualReadings[0].title, "Acabamentos coerentes");
});

test("o motor repete uma saída estrutural inválida uma única vez", async () => {
  let attempts = 0;
  const engine = createAnalysisEngine(dependencies({
    extractor: { extract: async () => {
      attempts += 1;
      return attempts === 1 ? { versao: "errada", factos: [], regioes_fotografias: [], leituras_visuais: [] } : extraction();
    } }
  }));
  await engine.analyze({ images, city: "Porto" });
  assert.equal(attempts, 2);
});

test("o motor limita regiões fotográficas válidas às margens da captura", async () => {
  let regions;
  const engine = createAnalysisEngine(dependencies({
    extractor: { extract: async () => extraction({
      regioes_fotografias: [{ fonte_imagem: 1, x: 850, y: 900, largura: 300, altura: 250 }]
    }) },
    classifier: { classify: async ({ extraction: received }) => {
      regions = received.regioes_fotografias;
      return classification();
    } }
  }));
  await engine.analyze({ images, city: "Porto" });
  assert.deepEqual(regions, [{ fonte_imagem: 1, x: 850, y: 900, largura: 150, altura: 100 }]);
});

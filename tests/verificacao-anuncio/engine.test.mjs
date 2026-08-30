import assert from "node:assert/strict";
import test from "node:test";
import { ClosedAnalysisError, createAnalysisEngine } from "../../src/lib/verificacao-anuncio/engine.mjs";
import { classification, extraction, photo } from "./fixtures.mjs";

const images = Array.from({ length: 4 }, (_, index) => ({ id: `upload-${index + 1}` }));

const dependencies = (overrides = {}) => ({
  extractor: { extract: async () => extraction() },
  photoProcessor: { prepare: async () => [photo("sala")] },
  reverseImageProvider: { name: "fixture", search: async () => [] },
  candidateValidator: { validate: async () => { throw new Error("não chamado"); } },
  priceReferenceProvider: { lookup: async () => null },
  classifier: { classify: async () => classification() },
  ...overrides
});

test("o motor produz 12 verificações e ações apenas nos itens por confirmar", async () => {
  const result = await createAnalysisEngine(dependencies()).analyze({ images, city: "Porto" });
  assert.equal(result.report.totalCount, 12);
  assert.equal(result.report.nextActions.length, 12);
  assert.equal(result.reverseResults[0].state, "sem_correspondencia_encontrada");
});

test("o motor repete uma saída estrutural inválida uma única vez", async () => {
  let attempts = 0;
  const engine = createAnalysisEngine(dependencies({
    extractor: { extract: async () => {
      attempts += 1;
      return attempts === 1 ? { versao: "errada", factos: [], regioes_fotografias: [] } : extraction();
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
    photoProcessor: { prepare: async ({ regions: received }) => {
      regions = received;
      return [photo("sala")];
    } }
  }));
  await engine.analyze({ images, city: "Porto" });
  assert.deepEqual(regions, [{ fonte_imagem: 1, x: 850, y: 900, largura: 150, altura: 100 }]);
});

test("a falha total da pesquisa visual fecha a análise e requer reembolso", async () => {
  const engine = createAnalysisEngine(dependencies({
    reverseImageProvider: { name: "fixture", search: async () => { throw new Error("indisponível"); } }
  }));
  await assert.rejects(
    engine.analyze({ images, city: "Porto" }),
    (error) => error instanceof ClosedAnalysisError && error.stage === "pesquisa_visual" && error.refundRequired
  );
});

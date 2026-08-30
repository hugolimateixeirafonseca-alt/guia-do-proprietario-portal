import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProviderBenchmark, EXPECTED_CASES } from "../../src/lib/verificacao-anuncio/provider-benchmark.mjs";

const completeSet = (provider, overrides = {}) => Object.entries(EXPECTED_CASES).map(([caseId, actualState], index) => ({
  provider,
  caseId,
  actualState,
  latencyMs: 100 + index,
  costUsd: 0.001,
  ...overrides[caseId]
}));

test("o benchmark favorece segurança, precisão, disponibilidade, custo e latência", () => {
  const safe = completeSet("google_cloud_vision");
  const unsafe = completeSet("tineye", { C: { actualState: "correspondencia_mesmo_contexto" } });
  const result = evaluateProviderBenchmark([...unsafe, ...safe]);
  assert.equal(result[0].provider, "google_cloud_vision");
  assert.equal(result[0].passesSafetyGate, true);
  assert.equal(result[1].falseStrongMatches, 1);
});


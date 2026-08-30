import assert from "node:assert/strict";
import test from "node:test";
import dataset from "../../src/data/verificacao-anuncio/precos-referencia.json" with { type: "json" };
import { createPriceReferenceProvider, validatePriceReferenceDataset } from "../../src/lib/verificacao-anuncio/price-reference.mjs";

test("a tabela contém apenas as dez cidades e referências documentadas", async () => {
  validatePriceReferenceDataset(dataset);
  const provider = createPriceReferenceProvider(dataset);
  const lisboa = await provider.lookup({ city: "Lisboa", facts: [
    { campo: "preco_mensal", presente: true, valor: "1.200 €" },
    { campo: "area", presente: true, valor: "60 m²" }
  ] });
  assert.equal(lisboa.euros_per_m2, 23.5);
  assert.equal(lisboa.listing_euros_per_m2, 20);
  assert.equal(lisboa.observed_period, "2026-07");
  assert.equal(await provider.lookup({ city: "Setúbal", facts: [] }), null);
  assert.equal(await provider.lookup({ city: "Lisboa", facts: [] }), null);
});

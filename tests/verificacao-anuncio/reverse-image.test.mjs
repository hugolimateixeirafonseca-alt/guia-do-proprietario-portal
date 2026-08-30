import assert from "node:assert/strict";
import test from "node:test";
import {
  finalizeReverseEvidence,
  normalizeGoogleVisionResult,
  normalizeTinEyeResult
} from "../../src/lib/verificacao-anuncio/reverse-image.mjs";
import { createCandidateValidator } from "../../src/lib/verificacao-anuncio/candidate-validator.mjs";

test("o validador pode ser criado com a configuração padrão do Worker", () => {
  assert.equal(typeof createCandidateValidator().validate, "function");
});

test("normaliza apenas páginas HTTPS do Google Vision", () => {
  const results = normalizeGoogleVisionResult({ responses: [{ webDetection: { pagesWithMatchingImages: [
    { url: "https://example.com/a", fullMatchingImages: [{ url: "https://cdn.example.com/a.jpg" }] },
    { url: "http://example.com/b" }
  ] } }] }, "sala");
  assert.equal(results.length, 1);
  assert.equal(results[0].match_type, "exact");
});

test("rejeita destinos privados, locais e URLs com credenciais", () => {
  const results = normalizeGoogleVisionResult({ responses: [{ webDetection: { pagesWithMatchingImages: [
    { url: "https://127.0.0.1/admin" },
    { url: "https://192.168.1.20/anuncio" },
    { url: "https://servico.internal/anuncio" },
    { url: "https://user:pass@example.com/anuncio" },
    { url: "https://example.com/anuncio" }
  ] } }] }, "sala");
  assert.deepEqual(results.map((item) => item.source_url), ["https://example.com/anuncio"]);
});

test("normaliza backlinks do TinEye e só promove contexto validado", () => {
  const [candidate] = normalizeTinEyeResult({ matches: [{ score: 99, backlinks: [{
    backlink: "https://example.org/anuncio",
    url: "https://example.org/image.jpg",
    crawl_date: "2026-01-01"
  }] }] }, "quarto");
  const evidence = finalizeReverseEvidence(candidate, { decision: "near_exact" }, {
    verified: true,
    context_relation: "different",
    excerpt: "Quarto anunciado em Barcelona.",
    location: "Barcelona"
  });
  assert.equal(evidence.state, "correspondencia_contexto_diferente");
});

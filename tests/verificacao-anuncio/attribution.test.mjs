import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVerificationAttribution } from "../../src/lib/verificacao-anuncio/attribution.mjs";

test("identifica a campanha enviada pelo Sender", () => {
  assert.deepEqual(normalizeVerificationAttribution({
    source: "sender",
    medium: "email",
    campaign: "kit_estudante",
    content: "pre_analise_ia"
  }), {
    channel: "email_sender",
    source: "sender",
    medium: "email",
    campaign: "kit_estudante",
    content: "pre_analise_ia"
  });
});

test("identifica o destaque da página de agradecimento", () => {
  assert.equal(normalizeVerificationAttribution({
    source: "kit_estudante",
    medium: "thank_you"
  }).channel, "kit_obrigado");
});

test("não aceita valores arbitrários nas métricas", () => {
  assert.deepEqual(normalizeVerificationAttribution({ source: "<script>" }), {
    channel: "direto",
    source: "",
    medium: "",
    campaign: "",
    content: ""
  });
});

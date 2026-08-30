import assert from "node:assert/strict";
import test from "node:test";
import { VERIFICATION_CONFIG } from "../../src/lib/verificacao-anuncio/verification-config.mjs";
import {
  validateActionConfiguration,
  validateClassification,
  validateExtraction,
  validateReverseEvidence,
  VerificationValidationError
} from "../../src/lib/verificacao-anuncio/validate.mjs";
import { classification, extraction } from "./fixtures.mjs";

test("a configuração fixa contém as 12 ações válidas", () => {
  assert.equal(validateActionConfiguration(), VERIFICATION_CONFIG);
});

test("a extração exige fonte literal e coordenadas dentro da imagem", () => {
  assert.equal(validateExtraction(extraction(), 4).factos[0].valor, "Porto");
  assert.throws(() => validateExtraction(extraction({
    regioes_fotografias: [{ fonte_imagem: 1, x: 900, y: 0, largura: 200, altura: 500 }]
  }), 4), VerificationValidationError);
});

test("a classificação bloqueia linguagem proibida, PII e confirmação da verificação 11", () => {
  const output = classification();
  output.verificacoes[0].observacao = "Este contacto é seguro: pessoa@example.com";
  output.verificacoes[10] = {
    id: 11,
    estado: "confirmado",
    leitura: "informacao_encontrada",
    observacao: "Documento presente.",
    evidencia_ids: ["facto_cidade"]
  };
  assert.throws(() => validateClassification(output, ["facto_cidade"]), VerificationValidationError);
});

test("uma localização externa só passa quando aparece no excerto validado", () => {
  const base = {
    id: "imagem_sala_google_1",
    photo_id: "sala",
    provider: "google_cloud_vision",
    state: "correspondencia_contexto_diferente",
    match_type: "near_exact",
    source_url: "https://example.com/anuncio",
    source_domain: "example.com",
    matched_image_url: "https://example.com/foto.jpg",
    context_verified: true,
    context_excerpt: "Apartamento disponível em Madrid.",
    source_location: "Madrid",
    source_date: null
  };
  assert.equal(validateReverseEvidence(base).source_location, "Madrid");
  assert.throws(() => validateReverseEvidence({ ...base, source_location: "Lisboa" }), VerificationValidationError);
});

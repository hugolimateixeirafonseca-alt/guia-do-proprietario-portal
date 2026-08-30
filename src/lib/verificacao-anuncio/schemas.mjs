import {
  ENGINE_VERSION,
  EXTRACTION_FIELDS,
  REVERSE_IMAGE_STATES,
  REVERSE_MATCH_TYPES,
  VERIFICATION_READINGS,
  VERIFICATION_STATES
} from "./constants.mjs";

export const EXTRACTION_SCHEMA = Object.freeze({
  type: "object",
  required: ["versao", "factos", "regioes_fotografias"],
  additionalProperties: false,
  properties: {
    versao: { type: "string", enum: [ENGINE_VERSION] },
    factos: {
      type: "array",
      minItems: 1,
      maxItems: 60,
      items: {
        type: "object",
        required: ["id", "campo", "presente", "valor", "fontes_imagem", "citacao"],
        additionalProperties: false,
        properties: {
          id: { type: "string", pattern: "^facto_[a-z0-9_]+$" },
          campo: { type: "string", enum: EXTRACTION_FIELDS },
          presente: { type: "boolean" },
          valor: { type: ["string", "null"] },
          fontes_imagem: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: { type: "integer", minimum: 1, maximum: 8 }
          },
          citacao: { type: ["string", "null"] }
        }
      }
    },
    regioes_fotografias: {
      type: "array",
      maxItems: 32,
      items: {
        type: "object",
        required: ["fonte_imagem", "x", "y", "largura", "altura"],
        additionalProperties: false,
        properties: {
          fonte_imagem: { type: "integer", minimum: 1, maximum: 8 },
          x: { type: "integer", minimum: 0, maximum: 1000 },
          y: { type: "integer", minimum: 0, maximum: 1000 },
          largura: { type: "integer", minimum: 1, maximum: 1000 },
          altura: { type: "integer", minimum: 1, maximum: 1000 }
        }
      }
    }
  }
});

export const CLASSIFICATION_SCHEMA = Object.freeze({
  type: "object",
  required: ["versao", "verificacoes"],
  additionalProperties: false,
  properties: {
    versao: { type: "string", enum: [ENGINE_VERSION] },
    verificacoes: {
      type: "array",
      minItems: 12,
      maxItems: 12,
      items: {
        type: "object",
        required: ["id", "estado", "leitura", "observacao", "evidencia_ids"],
        additionalProperties: false,
        properties: {
          id: { type: "integer", minimum: 1, maximum: 12 },
          estado: { type: "string", enum: VERIFICATION_STATES },
          leitura: { type: "string", enum: VERIFICATION_READINGS },
          observacao: { type: "string" },
          evidencia_ids: {
            type: "array",
            maxItems: 20,
            items: { type: "string", pattern: "^[a-z]+_[a-z0-9_]+$" }
          }
        }
      }
    }
  }
});

export const REVERSE_EVIDENCE_SCHEMA = Object.freeze({
  type: "object",
  required: [
    "id",
    "photo_id",
    "provider",
    "state",
    "match_type",
    "source_url",
    "source_domain",
    "context_verified"
  ],
  additionalProperties: false,
  properties: {
    id: { type: "string", pattern: "^imagem_[a-z0-9_]+$" },
    photo_id: { type: "string" },
    provider: { type: "string" },
    state: { type: "string", enum: REVERSE_IMAGE_STATES },
    match_type: { type: "string", enum: REVERSE_MATCH_TYPES },
    source_url: { type: ["string", "null"] },
    source_domain: { type: ["string", "null"] },
    matched_image_url: { type: ["string", "null"] },
    context_verified: { type: "boolean" },
    context_excerpt: { type: ["string", "null"], maxLength: 500 },
    source_location: { type: ["string", "null"], maxLength: 120 },
    source_date: { type: ["string", "null"], maxLength: 40 }
  }
});

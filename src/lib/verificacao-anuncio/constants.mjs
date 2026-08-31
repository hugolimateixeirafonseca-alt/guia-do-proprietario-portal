export const ENGINE_VERSION = "1.6";

export const VERIFICATION_STATES = Object.freeze([
  "confirmado",
  "por_confirmar",
  "nao_verificavel"
]);

export const VERIFICATION_READINGS = Object.freeze([
  "informacao_encontrada",
  "confirmar_na_conversa",
  "sinal_atencao"
]);

export const VISUAL_READING_CATEGORIES = Object.freeze([
  "coerencia",
  "caracteristica_visivel",
  "ponto_a_confirmar",
  "limitacao_da_captura"
]);

export const EXTRACTION_FIELDS = Object.freeze([
  "cidade",
  "zona",
  "morada",
  "preco_mensal",
  "tipologia",
  "area",
  "despesas",
  "caucao",
  "sinal",
  "primeira_renda",
  "outros_pagamentos",
  "momento_pagamento",
  "visita_presencial",
  "contrato_escrito",
  "recibos",
  "titular_conta",
  "parte_arrendamento",
  "autorizacao_arrendar",
  "comunicacao_financas"
]);

export const MAX_UPLOAD_FILES = 8;
export const MIN_UPLOAD_FILES = 1;
export const MAX_OBSERVATION_LENGTH = 160;

export const FORBIDDEN_OUTPUT_PATTERNS = Object.freeze([
  /\b(in)?segur[oa]s?\b/iu,
  /\b(i)?leg[ií]tim\w*\b/iu,
  /\bburl\w*\b/iu,
  /\bfraud\w*\b/iu,
  /\bfi[aá]v\w*\b/iu,
  /\bde\s+confian[cç]a\b/iu,
  /\bparece\s+honest\w*\b/iu,
  /\bparece\s+suspeit\w*\b/iu,
  /\b(?:vers[aã]o|v)\s*\d+(?:[.,]\d+)?\b/iu
]);

export const PII_PATTERNS = Object.freeze({
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  iban: /\bPT50(?:[\s-]*\d){21}\b/iu,
  phone: /(?<!\d)(?:\+351[\s.-]*)?(?:2\d|9[1236])(?:[\s.-]*\d){7}(?!\d)/u
});

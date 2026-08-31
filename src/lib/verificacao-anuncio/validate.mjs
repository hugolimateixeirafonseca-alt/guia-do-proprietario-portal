import {
  ENGINE_VERSION,
  EXTRACTION_FIELDS,
  FORBIDDEN_OUTPUT_PATTERNS,
  MAX_OBSERVATION_LENGTH,
  PII_PATTERNS,
  VISUAL_READING_CATEGORIES,
  VERIFICATION_READINGS,
  VERIFICATION_STATES
} from "./constants.mjs";
import { VERIFICATION_CONFIG } from "./verification-config.mjs";

export class VerificationValidationError extends Error {
  constructor(issues) {
    super(`Output inválido: ${issues.join("; ")}`);
    this.name = "VerificationValidationError";
    this.issues = issues;
  }
}
const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function normalizeExtractionGeometry(output) {
  if (!isPlainObject(output) || !Array.isArray(output.regioes_fotografias)) return output;
  return {
    ...output,
    regioes_fotografias: output.regioes_fotografias.map((region) => {
      const values = [region?.x, region?.y, region?.largura, region?.altura];
      if (values.some((value) => !Number.isInteger(value))) return region;
      if (region.x < 0 || region.y < 0 || region.largura < 1 || region.altura < 1) return region;
      if (region.x > 1000 || region.y > 1000) return region;
      const x = Math.min(region.x, 999);
      const y = Math.min(region.y, 999);
      return {
        ...region,
        x,
        y,
        largura: Math.min(region.largura, 1000 - x),
        altura: Math.min(region.altura, 1000 - y)
      };
    })
  };
}

export function findDisallowedText(text) {
  const value = String(text ?? "");
  const forbidden = FORBIDDEN_OUTPUT_PATTERNS.find((pattern) => pattern.test(value));
  if (forbidden) return "palavra ou formulação proibida";
  if (PII_PATTERNS.email.test(value)) return "email";
  if (PII_PATTERNS.iban.test(value)) return "IBAN";
  if (PII_PATTERNS.phone.test(value)) return "telefone";
  if (/https?:\/\//iu.test(value) || /\bwww\./iu.test(value)) return "URL";
  return null;
}

export function validateActionConfiguration(config = VERIFICATION_CONFIG) {
  const issues = [];
  if (!Array.isArray(config) || config.length !== 12) issues.push("a configuração deve ter 12 verificações");
  const ids = new Set();
  for (const verification of config ?? []) {
    if (!Number.isInteger(verification?.id) || verification.id < 1 || verification.id > 12) {
      issues.push("id de configuração inválido");
      continue;
    }
    if (ids.has(verification.id)) issues.push(`id ${verification.id} repetido`);
    ids.add(verification.id);
    const disallowed = findDisallowedText(verification.action);
    if (disallowed) issues.push(`ação #${verification.id} contém ${disallowed}`);
    const questionDisallowed = findDisallowedText(verification.question);
    if (questionDisallowed) issues.push(`pergunta #${verification.id} contém ${questionDisallowed}`);
  }
  for (let id = 1; id <= 12; id += 1) {
    if (!ids.has(id)) issues.push(`falta a configuração #${id}`);
  }
  if (issues.length) throw new VerificationValidationError(issues);
  return config;
}

export function validateExtraction(output, imageCount = 8) {
  const issues = [];
  if (!isPlainObject(output)) throw new VerificationValidationError(["extração não é um objeto"]);
  if (output.versao !== ENGINE_VERSION) issues.push("versão de extração incorreta");
  if (!Array.isArray(output.factos) || output.factos.length === 0 || output.factos.length > 60) {
    issues.push("factos devem conter entre 1 e 60 itens");
  }
  const factIds = new Set();
  for (const fact of output.factos ?? []) {
    if (!isPlainObject(fact)) {
      issues.push("facto inválido");
      continue;
    }
    if (!/^facto_[a-z0-9_]+$/u.test(fact.id ?? "")) issues.push("id de facto inválido");
    if (factIds.has(fact.id)) issues.push(`facto repetido: ${fact.id}`);
    factIds.add(fact.id);
    if (!EXTRACTION_FIELDS.includes(fact.campo)) issues.push(`campo de facto inválido: ${fact.campo}`);
    if (typeof fact.presente !== "boolean") issues.push(`presente inválido em ${fact.id}`);
    if (fact.valor !== null && typeof fact.valor !== "string") issues.push(`valor inválido em ${fact.id}`);
    if (fact.presente && (!fact.valor || !String(fact.valor).trim())) issues.push(`facto presente sem valor em ${fact.id}`);
    if (!fact.presente && fact.valor !== null) issues.push(`facto ausente com valor em ${fact.id}`);
    if (!Array.isArray(fact.fontes_imagem) || fact.fontes_imagem.length === 0) {
      issues.push(`facto sem fonte em ${fact.id}`);
    } else if (fact.fontes_imagem.some((source) => !Number.isInteger(source) || source < 1 || source > imageCount)) {
      issues.push(`fonte de imagem inválida em ${fact.id}`);
    }
    if (fact.citacao !== null && typeof fact.citacao !== "string") issues.push(`citação inválida em ${fact.id}`);
  }
  if (!Array.isArray(output.regioes_fotografias) || output.regioes_fotografias.length > 32) {
    issues.push("regiões de fotografias inválidas");
  }
  for (const region of output.regioes_fotografias ?? []) {
    const values = [region?.x, region?.y, region?.largura, region?.altura];
    if (!Number.isInteger(region?.fonte_imagem) || region.fonte_imagem < 1 || region.fonte_imagem > imageCount) {
      issues.push("fonte inválida numa região de fotografia");
    }
    if (values.some((value) => !Number.isInteger(value))) issues.push("coordenada não inteira numa região de fotografia");
    if (region?.x < 0 || region?.y < 0 || region?.largura < 1 || region?.altura < 1) issues.push("coordenada fora do limite");
    if ((region?.x ?? 0) + (region?.largura ?? 0) > 1000 || (region?.y ?? 0) + (region?.altura ?? 0) > 1000) {
      issues.push("região de fotografia ultrapassa a imagem");
    }
  }
  if (!Array.isArray(output.leituras_visuais) || output.leituras_visuais.length > 10) {
    issues.push("leituras visuais inválidas");
  }
  const visualIds = new Set();
  for (const reading of output.leituras_visuais ?? []) {
    if (!isPlainObject(reading)) {
      issues.push("leitura visual inválida");
      continue;
    }
    if (!/^visual_[a-z0-9_]+$/u.test(reading.id ?? "")) issues.push("id de leitura visual inválido");
    if (visualIds.has(reading.id)) issues.push(`leitura visual repetida: ${reading.id}`);
    visualIds.add(reading.id);
    if (!VISUAL_READING_CATEGORIES.includes(reading.categoria)) issues.push(`categoria visual inválida: ${reading.categoria}`);
    for (const [field, value] of [["título", reading.titulo], ["observação", reading.observacao]]) {
      if (typeof value !== "string" || !value.trim() || value.length > 220) issues.push(`${field} visual inválido em ${reading.id}`);
      else {
        const disallowed = findDisallowedText(value);
        if (disallowed) issues.push(`${field} visual em ${reading.id} contém ${disallowed}`);
      }
    }
    if (reading.confirmacao_recomendada !== null) {
      if (typeof reading.confirmacao_recomendada !== "string" || !reading.confirmacao_recomendada.trim() || reading.confirmacao_recomendada.length > 260) {
        issues.push(`confirmação visual inválida em ${reading.id}`);
      } else {
        const disallowed = findDisallowedText(reading.confirmacao_recomendada);
        if (disallowed) issues.push(`confirmação visual em ${reading.id} contém ${disallowed}`);
      }
    }
    if (!Array.isArray(reading.fontes_imagem) || reading.fontes_imagem.length === 0
      || reading.fontes_imagem.some((source) => !Number.isInteger(source) || source < 1 || source > imageCount)) {
      issues.push(`fonte inválida na leitura visual ${reading.id}`);
    }
  }
  if (issues.length) throw new VerificationValidationError(issues);
  return output;
}
export function validateClassification(output, availableEvidenceIds = []) {
  const issues = [];
  if (!isPlainObject(output)) throw new VerificationValidationError(["classificação não é um objeto"]);
  if (output.versao !== ENGINE_VERSION) issues.push("versão de classificação incorreta");
  if (!Array.isArray(output.verificacoes) || output.verificacoes.length !== 12) {
    issues.push("a classificação deve ter exatamente 12 verificações");
  }
  const allowedEvidence = new Set(availableEvidenceIds);
  const ids = new Set();
  for (const verification of output.verificacoes ?? []) {
    if (!isPlainObject(verification)) {
      issues.push("verificação inválida");
      continue;
    }
    if (!Number.isInteger(verification.id) || verification.id < 1 || verification.id > 12) {
      issues.push("id de verificação inválido");
      continue;
    }
    if (ids.has(verification.id)) issues.push(`id ${verification.id} repetido`);
    ids.add(verification.id);
    if (!VERIFICATION_STATES.includes(verification.estado)) issues.push(`estado inválido na verificação #${verification.id}`);
    if (!VERIFICATION_READINGS.includes(verification.leitura)) issues.push(`leitura inválida na verificação #${verification.id}`);
    if (verification.estado === "confirmado" && verification.leitura !== "informacao_encontrada") {
      issues.push(`verificação #${verification.id} confirmada com leitura incompatível`);
    }
    if (typeof verification.observacao !== "string" || verification.observacao.length > MAX_OBSERVATION_LENGTH) {
      issues.push(`observação inválida na verificação #${verification.id}`);
    } else {
      const disallowed = findDisallowedText(verification.observacao);
      if (disallowed) issues.push(`observação #${verification.id} contém ${disallowed}`);
    }
    if (!Array.isArray(verification.evidencia_ids)) {
      issues.push(`evidência inválida na verificação #${verification.id}`);
    } else {
      if (new Set(verification.evidencia_ids).size !== verification.evidencia_ids.length) {
        issues.push(`evidência repetida na verificação #${verification.id}`);
      }
      for (const evidenceId of verification.evidencia_ids) {
        if (!allowedEvidence.has(evidenceId)) issues.push(`evidência desconhecida: ${evidenceId}`);
      }
      if (verification.estado === "confirmado" && verification.evidencia_ids.length === 0) {
        issues.push(`verificação #${verification.id} confirmada sem evidência`);
      }
    }
    if (verification.id === 11 && verification.estado === "confirmado") {
      issues.push("a verificação #11 não pode ser confirmada apenas com as capturas do anúncio");
    }
  }
  for (let id = 1; id <= 12; id += 1) {
    if (!ids.has(id)) issues.push(`falta a verificação #${id}`);
  }
  if (issues.length) throw new VerificationValidationError(issues);
  return output;
}

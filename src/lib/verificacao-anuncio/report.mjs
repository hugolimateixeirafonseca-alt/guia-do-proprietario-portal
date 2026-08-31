import { ENGINE_VERSION } from "./constants.mjs";
import { validateClassification } from "./validate.mjs";
import { VERIFICATION_BY_ID } from "./verification-config.mjs";

export function buildReportModel({ classification, evidence = [], priceReference = null }) {
  const evidenceIds = evidence.map((item) => item.id);
  validateClassification(classification, evidenceIds);
  const checks = classification.verificacoes
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((result) => {
      const config = VERIFICATION_BY_ID.get(result.id);
      return {
        id: result.id,
        name: config.name,
        state: result.estado,
        reading: result.leitura,
        observation: result.observacao,
        action: result.estado !== "confirmado" ? config.action : null,
        evidence: result.evidencia_ids
      };
    });
  return {
    version: ENGINE_VERSION,
    confirmedCount: checks.filter((check) => check.state === "confirmado").length,
    totalCount: 12,
    checks,
    observedFacts: evidence
      .filter((item) => item.id?.startsWith("facto_") && item.presente === true && item.valor !== null)
      .filter((item) => !["titular_conta", "parte_arrendamento", "autorizacao_arrendar"].includes(item.campo))
      .map((item) => ({
        field: item.campo,
        value: item.valor,
        sourceImages: item.fontes_imagem,
        quote: item.citacao
      })),
    nextActions: checks.filter((check) => check.state !== "confirmado").map((check) => ({
      verificationId: check.id,
      text: check.action
    })),
    visualReadings: evidence
      .filter((item) => item.id?.startsWith("visual_"))
      .map((item) => ({
        category: item.categoria,
        title: item.titulo,
        observation: item.observacao,
        recommendedConfirmation: item.confirmacao_recomendada,
        sourceImages: item.fontes_imagem
      })),
    priceReference
  };
}

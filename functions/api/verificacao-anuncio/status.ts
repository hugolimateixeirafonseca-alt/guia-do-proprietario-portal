import {
  checkRateLimit,
  findVerification,
  json,
  readToken,
  requireConfiguration,
  safeError,
  type RequestContext
} from "../../lib/verificacao-anuncio";

const publicState = (estado: string) => ({
  aguarda_upload: { etapa: "aguarda_upload", progresso: 0 },
  em_analise: { etapa: "em_analise", progresso: 35 },
  entregue: { etapa: "entregue", progresso: 100 },
  expirado: { etapa: "expirado", progresso: 100 },
  falhou_reembolsado: { etapa: "falhou_reembolsado", progresso: 100 },
  sem_upload_reembolsado: { etapa: "sem_upload_reembolsado", progresso: 100 }
}[estado] || { etapa: "em_processamento", progresso: 10 });

export const onRequestGet = async ({ request, env }: RequestContext) => {
  try {
    const config = requireConfiguration(env);
    await checkRateLimit(request, config.db, config.secret, 60);
    const token = readToken(request);
    const { row } = await findVerification(config.db, token);
    const relevantDeadline = row.estado === "aguarda_upload" ? row.uploadExpiraEm || row.expiraEm : row.expiraEm;
    const expired = Date.parse(relevantDeadline) <= Date.now() && row.estado !== "entregue";
    const state = publicState(expired ? "expirado" : row.estado);
    let captures = 0;
    try {
      const files = JSON.parse(row.ficheirosJson || "[]");
      captures = Array.isArray(files) ? files.length : 0;
    } catch {
      captures = 0;
    }
    return json({
      ok: true,
      ...state,
      capturas: captures,
      uploadEm: row.uploadEm,
      entregueEm: row.entregueEm,
      relatorioDisponivel: row.estado === "entregue"
    });
  } catch (error) {
    return safeError(error);
  }
};

import {
  PublicVerificationError,
  checkRateLimit,
  ensureSameOrigin,
  findVerification,
  json,
  readToken,
  requireConfiguration,
  safeError,
  type RequestContext
} from "../../lib/verificacao-anuncio";

export const onRequestPost = async ({ request, env }: RequestContext) => {
  try {
    ensureSameOrigin(request);
    const config = requireConfiguration(env, true);
    await checkRateLimit(request, config.db, `${config.secret}:retry`, 10);
    const token = readToken(request);
    const { row } = await findVerification(config.db, token);
    if (row.estado !== "em_analise" || row.pagamentoEstado !== "pago") throw new PublicVerificationError(409, "retry_not_available");

    const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recent = await config.db.prepare(
      `SELECT id FROM verificacao_anuncio_events
       WHERE job_id = ? AND tipo = 'analise_recuperacao_solicitada' AND criado_em >= ? LIMIT 1`
    ).bind(row.id, recentCutoff).first<{ id: number }>();
    if (recent) return json({ ok: true, queued: false });

    await config.queue!.send({ type: "verificacao_anuncio_analisar", verificacaoId: row.id });
    await config.db.prepare(
      `INSERT INTO verificacao_anuncio_events (job_id, tipo, estado, criado_em)
       VALUES (?, 'analise_recuperacao_solicitada', 'success', ?)`
    ).bind(row.id, new Date().toISOString()).run();
    return json({ ok: true, queued: true });
  } catch (error) {
    return safeError(error);
  }
};

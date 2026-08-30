import {
  PublicVerificationError,
  checkRateLimit,
  ensureSameOrigin,
  findVerification,
  json,
  readToken,
  readUpload,
  requireConfiguration,
  safeError,
  type RequestContext
} from "../../lib/verificacao-anuncio";

export const onRequestPost = async ({ request, env }: RequestContext) => {
  const storedKeys: string[] = [];
  let jobId = "";
  try {
    ensureSameOrigin(request);
    const config = requireConfiguration(env, true);
    await checkRateLimit(request, config.db, config.secret, 12);
    const token = readToken(request);
    const { row } = await findVerification(config.db, token);
    jobId = row.id;
    const uploadDeadline = row.uploadExpiraEm || row.expiraEm;
    if (Date.parse(uploadDeadline) <= Date.now()) throw new PublicVerificationError(410, "verification_expired");
    if (row.estado !== "aguarda_upload") throw new PublicVerificationError(409, "upload_already_completed");

    const upload = await readUpload(request);
    const files = [];
    for (const [index, capture] of upload.captures.entries()) {
      const key = `${row.id}/captura-${index + 1}-${crypto.randomUUID()}.${capture.extension}`;
      await config.uploads!.put(key, capture.bytes, {
        httpMetadata: { contentType: capture.contentType },
        customMetadata: { verificacaoId: row.id, ordem: String(index + 1) }
      });
      storedKeys.push(key);
      files.push({ key, contentType: capture.contentType, size: capture.size, ordem: index + 1 });
    }

    const now = new Date().toISOString();
    const imagesDeleteAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const update = await config.db.prepare(
      `UPDATE verificacao_anuncio_jobs
       SET estado = 'em_analise', cidade = ?, upload_em = ?, ficheiros_json = ?, imagens_apagar_em = ?
       WHERE id = ? AND estado = 'aguarda_upload'`
    ).bind(upload.cidade, now, JSON.stringify(files), imagesDeleteAt, row.id).run();
    if ((update.meta?.changes || 0) !== 1) throw new PublicVerificationError(409, "upload_already_completed");

    try {
      await config.queue!.send({ type: "verificacao_anuncio_analisar", verificacaoId: row.id });
    } catch (error) {
      await config.db.prepare(
        `UPDATE verificacao_anuncio_jobs
         SET estado = 'aguarda_upload', cidade = NULL, upload_em = NULL, ficheiros_json = NULL, imagens_apagar_em = NULL
         WHERE id = ? AND estado = 'em_analise'`
      ).bind(row.id).run();
      await config.uploads!.delete(storedKeys);
      storedKeys.length = 0;
      throw new PublicVerificationError(503, "processing_unavailable");
    }

    await config.db.prepare(
      `INSERT INTO verificacao_anuncio_events (job_id, tipo, estado, criado_em)
       VALUES (?, 'upload_recebido', 'success', ?)`
    ).bind(row.id, now).run();
    return json({ ok: true, etapa: "em_analise", progresso: 35, capturas: files.length }, 202);
  } catch (error) {
    if (storedKeys.length && env.VERIFICACAO_ANUNCIO_UPLOADS) {
      try { await env.VERIFICACAO_ANUNCIO_UPLOADS.delete(storedKeys); } catch { /* limpeza posterior por retenção */ }
    }
    if (jobId && env.VERIFICACAO_ANUNCIO_DB && !(error instanceof PublicVerificationError && error.code === "upload_already_completed")) {
      try {
        await env.VERIFICACAO_ANUNCIO_DB.prepare(
          `INSERT INTO verificacao_anuncio_events (job_id, tipo, estado, detalhe, criado_em)
           VALUES (?, 'upload_falhou', 'error', ?, ?)`
        ).bind(jobId, error instanceof Error ? error.message.slice(0, 80) : "unknown", new Date().toISOString()).run();
      } catch { /* o erro público não depende do diagnóstico */ }
    }
    return safeError(error);
  }
};

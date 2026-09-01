import priceDataset from "../../src/data/verificacao-anuncio/precos-referencia.json";
import { createAnalysisEngine } from "../../src/lib/verificacao-anuncio/engine.mjs";
import { createOpenAIResponsesAdapters } from "../../src/lib/verificacao-anuncio/openai-responses.mjs";
import { createPriceReferenceProvider } from "../../src/lib/verificacao-anuncio/price-reference.mjs";
import { buildPrecheckTeaser } from "../../src/lib/verificacao-anuncio/precheck.mjs";
import { buildVerificationEmail } from "../../src/lib/verificacao-anuncio/notification-email.mjs";
import { createSenderTransactionalClient } from "../../src/lib/verificacao-anuncio/sender-email.mjs";
import { createStripeRefund } from "../../src/lib/verificacao-anuncio/stripe-refund.mjs";
import { normalizeExtractionGeometry, validateExtraction } from "../../src/lib/verificacao-anuncio/validate.mjs";
import {
  decryptPrivateValue,
  sendVerificationMetaConversion,
  type D1Database,
  type R2Bucket
} from "../../functions/lib/verificacao-anuncio";

interface QueueMessage<T> {
  body: T;
  attempts?: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

interface MessageBatch<T> {
  messages: QueueMessage<T>[];
}

interface ScheduledController {
  waitUntil(promise: Promise<unknown>): void;
}

interface WorkerEnv {
  VERIFICACAO_ANUNCIO_DB: D1Database;
  VERIFICACAO_ANUNCIO_UPLOADS: R2Bucket;
  VERIFICACAO_ACCESS_SECRET: string;
  OPENAI_API_KEY: string;
  VERIFICACAO_EXTRACTION_MODEL?: string;
  VERIFICACAO_CLASSIFICATION_MODEL?: string;
  STRIPE_SECRET_KEY: string;
  SITE_URL: string;
  SENDER_API_TOKEN: string;
  SENDER_TRANSACTIONAL_FROM_EMAIL?: string;
  SENDER_TRANSACTIONAL_FROM_NAME?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_DATASET_ID?: string;
  META_GRAPH_VERSION?: string;
  META_TEST_EVENT_CODE?: string;
}

type VerificationMessage = {
  type: "verificacao_anuncio_pagamento_confirmado" | "verificacao_anuncio_precheck" | "verificacao_anuncio_analisar" | "verificacao_anuncio_meta_purchase";
  verificacaoId: string;
};

type NotificationType = "recebida" | "precheck" | "relatorio" | "falha" | "lembrete_24h" | "lembrete_7d" | "reembolso";

interface JobRow {
  id: string;
  estado: string;
  cidade: string | null;
  ficheirosJson: string | null;
  criadoEm: string;
  uploadExpiraEm: string | null;
  expiraEm: string;
  imagensApagarEm: string | null;
  imagensApagadas: number;
  processamentoBloqueadoEm: string | null;
  falhaEm: string | null;
  falhaMotivo: string | null;
  emailCipher: string;
  accessTokenCipher: string;
  stripePaymentId: string | null;
  pdfKey: string | null;
  precheckEstado: string;
  precheckJson: string | null;
  pagamentoEstado: string;
  metaAttributionCipher: string | null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const nowIso = () => new Date().toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const addHours = (value: string, hours: number) => new Date(Date.parse(value) + hours * 60 * 60 * 1000).toISOString();

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

function siteOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("invalid_site_url");
  return url.origin;
}

async function loadJob(db: D1Database, id: string) {
  if (!uuidPattern.test(id)) throw new Error("invalid_job_id");
  const job = await db.prepare(
    `SELECT id, estado, cidade, ficheiros_json AS ficheirosJson, criado_em AS criadoEm,
      upload_expira_em AS uploadExpiraEm, expira_em AS expiraEm,
      imagens_apagar_em AS imagensApagarEm, imagens_apagadas AS imagensApagadas,
      processamento_bloqueado_em AS processamentoBloqueadoEm, falha_em AS falhaEm,
      falha_motivo AS falhaMotivo, email_cipher AS emailCipher,
      access_token_cipher AS accessTokenCipher, stripe_payment_id AS stripePaymentId,
      relatorio_pdf_key AS pdfKey, precheck_estado AS precheckEstado,
      precheck_json AS precheckJson, pagamento_estado AS pagamentoEstado,
      meta_attribution_cipher AS metaAttributionCipher
     FROM verificacao_anuncio_jobs WHERE id = ? LIMIT 1`
  ).bind(id).first<JobRow>();
  if (!job) throw new Error("job_not_found");
  return job;
}

async function event(db: D1Database, jobId: string, type: string, state: "success" | "error", detail?: unknown) {
  const safeDetail = detail === undefined ? null : JSON.stringify(detail).slice(0, 1200);
  await db.prepare(
    `INSERT INTO verificacao_anuncio_events (job_id, tipo, estado, detalhe, criado_em)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(jobId, type, state, safeDetail, nowIso()).run();
}

async function trackMetaConversion(
  env: WorkerEnv,
  job: JobRow,
  eventName: string,
  eventId: string,
  customData: Record<string, unknown>,
  retryOnFailure = false
) {
  try {
    const result = await sendVerificationMetaConversion(env, job, { eventName, eventId, customData });
    await event(
      env.VERIFICACAO_ANUNCIO_DB,
      job.id,
      `meta_${eventName.toLowerCase()}`,
      result.sent ? "success" : "error",
      result.sent ? undefined : { state: "ignored", reason: result.reason }
    );
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 100) : "unknown";
    await event(env.VERIFICACAO_ANUNCIO_DB, job.id, `meta_${eventName.toLowerCase()}`, "error", { reason });
    if (retryOnFailure) throw error;
    return { sent: false, reason };
  }
}

async function acquireNotification(db: D1Database, jobId: string, type: NotificationType) {
  const now = nowIso();
  const inserted = await db.prepare(
    `INSERT OR IGNORE INTO verificacao_anuncio_notifications
      (job_id, tipo, estado, tentativas, criado_em, atualizado_em)
     VALUES (?, ?, 'processing', 1, ?, ?)`
  ).bind(jobId, type, now, now).run();
  if ((inserted.meta?.changes || 0) === 1) return true;
  const recovered = await db.prepare(
    `UPDATE verificacao_anuncio_notifications
     SET estado = 'processing', tentativas = tentativas + 1, erro = NULL, atualizado_em = ?
     WHERE job_id = ? AND tipo = ? AND (estado = 'error' OR (estado = 'processing' AND atualizado_em < ?))`
  ).bind(now, jobId, type, hoursAgo(1)).run();
  return (recovered.meta?.changes || 0) === 1;
}

async function sendNotification(env: WorkerEnv, job: JobRow, type: NotificationType) {
  if (!await acquireNotification(env.VERIFICACAO_ANUNCIO_DB, job.id, type)) return;
  try {
    const [email, token] = await Promise.all([
      decryptPrivateValue(job.emailCipher, env.VERIFICACAO_ACCESS_SECRET),
      decryptPrivateValue(job.accessTokenCipher, env.VERIFICACAO_ACCESS_SECRET)
    ]);
    const origin = siteOrigin(env.SITE_URL);
    // O token fica no caminho para sobreviver ao tracking de cliques do Sender,
    // que pode substituir os parâmetros da query string.
    const uploadUrl = `${origin}/verificacao/enviar/${encodeURIComponent(token)}/`;
    const reportUrl = `${origin}/verificacao/r/${encodeURIComponent(token)}`;
    const client = createSenderTransactionalClient({ apiToken: env.SENDER_API_TOKEN });
    const content = buildVerificationEmail(type, {
      uploadUrl,
      reportUrl,
      deadline: job.uploadExpiraEm || job.expiraEm,
      city: job.cidade || ""
    });
    await client.send({
      to: email,
      fromEmail: env.SENDER_TRANSACTIONAL_FROM_EMAIL || "geral@guiadoproprietario.pt",
      fromName: env.SENDER_TRANSACTIONAL_FROM_NAME || "Guia do Proprietário",
      ...content
    });
    const sentAt = nowIso();
    await env.VERIFICACAO_ANUNCIO_DB.prepare(
      `UPDATE verificacao_anuncio_notifications
       SET estado = 'completed', enviado_em = ?, atualizado_em = ?, erro = NULL
       WHERE job_id = ? AND tipo = ?`
    ).bind(sentAt, sentAt, job.id, type).run();
    await event(env.VERIFICACAO_ANUNCIO_DB, job.id, `email_${type}`, "success");
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 100) : "unknown";
    await env.VERIFICACAO_ANUNCIO_DB.prepare(
      `UPDATE verificacao_anuncio_notifications SET estado = 'error', erro = ?, atualizado_em = ?
       WHERE job_id = ? AND tipo = ?`
    ).bind(reason, nowIso(), job.id, type).run();
    await event(env.VERIFICACAO_ANUNCIO_DB, job.id, `email_${type}`, "error", { reason });
    throw error;
  }
}

async function loadImages(env: WorkerEnv, job: JobRow) {
  let files: Array<{ key: string; contentType: string }>;
  try { files = JSON.parse(job.ficheirosJson || "[]"); } catch { throw new Error("invalid_file_manifest"); }
  if (!Array.isArray(files) || files.length < 1 || files.length > 8) throw new Error("invalid_file_manifest");
  const images = [];
  for (const file of files) {
    if (typeof file.key !== "string" || !file.key.startsWith(`${job.id}/`)) throw new Error("invalid_file_key");
    const object = await env.VERIFICACAO_ANUNCIO_UPLOADS.get(file.key);
    if (!object) throw new Error("uploaded_file_missing");
    const bytes = new Uint8Array(await object.arrayBuffer());
    images.push({ bytes, contentType: file.contentType, dataUrl: `data:${file.contentType};base64,${bytesToBase64(bytes)}` });
  }
  return images;
}

async function refundJob(env: WorkerEnv, job: JobRow, targetState: "falhou_reembolsado" | "sem_upload_reembolsado", reason: string) {
  if (!job.stripePaymentId) throw new Error("refund_payment_intent_missing");
  if (!job.estado.endsWith("_reembolsado")) {
    const refund = await createStripeRefund({ apiKey: env.STRIPE_SECRET_KEY, paymentIntent: job.stripePaymentId, jobId: job.id, reason });
    const refundedAt = nowIso();
    await env.VERIFICACAO_ANUNCIO_DB.prepare(
      `UPDATE verificacao_anuncio_jobs
       SET estado = ?, reembolsado_em = ?, motivo_reembolso = ?, processamento_bloqueado_em = NULL
       WHERE id = ? AND estado NOT IN ('falhou_reembolsado', 'sem_upload_reembolsado')`
    ).bind(targetState, refundedAt, reason, job.id).run();
    await event(env.VERIFICACAO_ANUNCIO_DB, job.id, "reembolso_automatico", "success", { refundStatus: refund.status, reason });
  }
  await sendNotification(env, await loadJob(env.VERIFICACAO_ANUNCIO_DB, job.id), "reembolso");
}

async function analyzeJob(env: WorkerEnv, job: JobRow, attempts: number) {
  if (job.estado === "entregue") {
    await sendNotification(env, job, "relatorio");
    return;
  }
  if (job.falhaEm) {
    await refundJob(env, job, "falhou_reembolsado", job.falhaMotivo || "falha_tecnica_analise");
    return;
  }
  if (job.estado !== "em_analise" || job.pagamentoEstado !== "pago") return;
  const lock = await env.VERIFICACAO_ANUNCIO_DB.prepare(
    `UPDATE verificacao_anuncio_jobs SET processamento_bloqueado_em = ?
     WHERE id = ? AND estado = 'em_analise'
       AND (processamento_bloqueado_em IS NULL OR processamento_bloqueado_em < ?)`
  ).bind(nowIso(), job.id, hoursAgo(1)).run();
  if ((lock.meta?.changes || 0) !== 1) return;

  let analysisDelivered = false;
  let analysisStage = "load_images";
  try {
    const images = await loadImages(env, job);
    analysisStage = "analysis_engine";
    const usage: unknown[] = [];
    const ai = createOpenAIResponsesAdapters({
      apiKey: env.OPENAI_API_KEY,
      extractionModel: env.VERIFICACAO_EXTRACTION_MODEL || "gpt-5.4-mini",
      classificationModel: env.VERIFICACAO_CLASSIFICATION_MODEL || "gpt-5.4-mini",
      onUsage: (record: unknown) => { usage.push(record); }
    });
    const engine = createAnalysisEngine({
      extractor: ai.extractor,
      priceReferenceProvider: createPriceReferenceProvider(priceDataset),
      classifier: ai.classifier
    });
    let precheckExtraction = null;
    try { precheckExtraction = JSON.parse(job.precheckJson || "null")?.extraction || null; } catch { /* faz nova extração */ }
    const result = await engine.analyze({ images, city: job.cidade, extraction: precheckExtraction });
    const deliveredAt = nowIso();
    const costRecord = { openai: usage };
    const update = await env.VERIFICACAO_ANUNCIO_DB.prepare(
      `UPDATE verificacao_anuncio_jobs SET estado = 'entregue', entregue_em = ?, resultado_json = ?,
        pesquisa_visual_json = NULL, versao_motor = ?, versao_pesquisa_visual = NULL, relatorio_pdf_key = NULL,
        custo_json = ?, processamento_bloqueado_em = NULL
       WHERE id = ? AND estado = 'em_analise'`
    ).bind(deliveredAt, JSON.stringify(result.report), result.report.version,
      JSON.stringify(costRecord), job.id).run();
    if ((update.meta?.changes || 0) !== 1) throw new Error("delivery_state_conflict");
    analysisDelivered = true;
    await event(env.VERIFICACAO_ANUNCIO_DB, job.id, "analise_concluida", "success", costRecord);
    await sendNotification(env, await loadJob(env.VERIFICACAO_ANUNCIO_DB, job.id), "relatorio");
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 100) : "unknown";
      const rootCause = error instanceof Error && error.cause instanceof Error
        ? error.cause.message.slice(0, 180)
        : undefined;
      console.error("verification_analysis_stage_failed", {
        jobId: job.id,
        attempts,
        stage: analysisStage,
        reason,
        rootCause,
        stack: error instanceof Error ? error.stack?.slice(0, 1800) : undefined
      });
    if (analysisDelivered) throw error;
    if (attempts < 12) {
      await env.VERIFICACAO_ANUNCIO_DB.prepare(
        "UPDATE verificacao_anuncio_jobs SET processamento_bloqueado_em = NULL WHERE id = ? AND estado = 'em_analise'"
      ).bind(job.id).run();
        await event(env.VERIFICACAO_ANUNCIO_DB, job.id, "analise_tentativa_falhou", "error", { attempts, reason, rootCause });
      throw error;
    }
    await env.VERIFICACAO_ANUNCIO_DB.prepare(
      `UPDATE verificacao_anuncio_jobs SET falha_em = ?, falha_motivo = ?, processamento_bloqueado_em = NULL
       WHERE id = ? AND estado = 'em_analise'`
    ).bind(nowIso(), reason, job.id).run();
    const failedJob = await loadJob(env.VERIFICACAO_ANUNCIO_DB, job.id);
    await event(env.VERIFICACAO_ANUNCIO_DB, job.id, "analise_falhou", "error", { reason });
    await refundJob(env, failedJob, "falhou_reembolsado", reason);
    await sendNotification(env, await loadJob(env.VERIFICACAO_ANUNCIO_DB, job.id), "falha");
  }
}

async function precheckJob(env: WorkerEnv, job: JobRow, attempts: number) {
  if (job.pagamentoEstado !== "pendente") return;
  if (job.precheckEstado === "completed") {
    await trackMetaConversion(env, job, "PreVerificationComplete", `precheck-${job.id}`, {
      content_name: "Pré-verificação de anúncio",
      content_category: "verificacao_anuncio"
    });
    await sendNotification(env, job, "precheck");
    return;
  }
  if (job.precheckEstado !== "processing") return;
  try {
    const images = await loadImages(env, job);
    const usage: unknown[] = [];
    const ai = createOpenAIResponsesAdapters({
      apiKey: env.OPENAI_API_KEY,
      extractionModel: env.VERIFICACAO_EXTRACTION_MODEL || "gpt-5.4-mini",
      classificationModel: env.VERIFICACAO_CLASSIFICATION_MODEL || "gpt-5.4-mini",
      onUsage: (record: unknown) => { usage.push(record); }
    });
    let extraction;
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        extraction = validateExtraction(
          normalizeExtractionGeometry(await ai.extractor.extract({ images, city: job.cidade, attempt })),
          images.length
        );
        break;
      } catch (error) { lastError = error; }
    }
    if (!extraction) throw lastError || new Error("precheck_extraction_failed");
    const teaser = buildPrecheckTeaser(extraction, images.length);
    await env.VERIFICACAO_ANUNCIO_DB.prepare(
      `UPDATE verificacao_anuncio_jobs SET precheck_estado = 'completed', precheck_json = ?, custo_json = ?
       WHERE id = ? AND precheck_estado = 'processing' AND pagamento_estado = 'pendente'`
    ).bind(JSON.stringify({ teaser, extraction }), JSON.stringify({ precheckOpenai: usage }), job.id).run();
    await event(env.VERIFICACAO_ANUNCIO_DB, job.id, "precheck_concluido", "success", {
      factCount: teaser.factCount,
      photoCount: teaser.photoCount,
      useful: teaser.useful
    });
    const completedJob = await loadJob(env.VERIFICACAO_ANUNCIO_DB, job.id);
    await trackMetaConversion(env, completedJob, "PreVerificationComplete", `precheck-${job.id}`, {
      content_name: "Pré-verificação de anúncio",
      content_category: "verificacao_anuncio"
    });
    await sendNotification(env, completedJob, "precheck");
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 100) : "unknown";
    await event(env.VERIFICACAO_ANUNCIO_DB, job.id, "precheck_tentativa_falhou", "error", { attempts, reason });
    if (attempts < 5) throw error;
    await env.VERIFICACAO_ANUNCIO_DB.prepare(
      "UPDATE verificacao_anuncio_jobs SET precheck_estado = 'failed', falha_em = ?, falha_motivo = ? WHERE id = ? AND pagamento_estado = 'pendente'"
    ).bind(nowIso(), reason, job.id).run();
  }
}

async function cleanUploadedImages(env: WorkerEnv, job: JobRow) {
  let files: Array<{ key?: string }> = [];
  try { files = JSON.parse(job.ficheirosJson || "[]"); } catch { /* o manifesto inválido não impede a marcação segura */ }
  const keys = files.map((file) => file.key).filter((key): key is string => typeof key === "string" && key.startsWith(`${job.id}/`));
  if (keys.length) await env.VERIFICACAO_ANUNCIO_UPLOADS.delete(keys);
  await env.VERIFICACAO_ANUNCIO_DB.prepare(
    "UPDATE verificacao_anuncio_jobs SET imagens_apagadas = 1, ficheiros_json = NULL WHERE id = ? AND imagens_apagadas = 0"
  ).bind(job.id).run();
  await event(env.VERIFICACAO_ANUNCIO_DB, job.id, "imagens_eliminadas_48h", "success", { count: keys.length });
}

async function expireReport(env: WorkerEnv, job: JobRow) {
  if (job.pdfKey?.startsWith(`${job.id}/`)) await env.VERIFICACAO_ANUNCIO_UPLOADS.delete(job.pdfKey);
  await env.VERIFICACAO_ANUNCIO_DB.prepare(
    `UPDATE verificacao_anuncio_jobs SET estado = 'expirado', resultado_json = NULL,
      pesquisa_visual_json = NULL, relatorio_pdf_key = NULL, custo_json = NULL
     WHERE id = ? AND estado = 'entregue'`
  ).bind(job.id).run();
  await event(env.VERIFICACAO_ANUNCIO_DB, job.id, "relatorio_expirado", "success");
}

async function runScheduled(env: WorkerEnv) {
  const now = nowIso();
  const waiting = await env.VERIFICACAO_ANUNCIO_DB.prepare(
    `SELECT id FROM verificacao_anuncio_jobs
     WHERE estado = 'aguarda_upload' AND criado_em <= ? ORDER BY criado_em LIMIT 100`
  ).bind(hoursAgo(24)).all<{ id: string }>();
  for (const item of waiting.results) {
    try {
      const job = await loadJob(env.VERIFICACAO_ANUNCIO_DB, item.id);
      if (job.uploadExpiraEm && job.uploadExpiraEm <= now) {
        await refundJob(env, job, "sem_upload_reembolsado", "prazo_upload_expirado");
      } else {
        await sendNotification(env, job, "lembrete_24h");
        if (addHours(job.criadoEm, 24 * 7) <= now) await sendNotification(env, job, "lembrete_7d");
      }
    } catch (error) {
      console.error("verification_scheduled_waiting_failed", { jobId: item.id, error: error instanceof Error ? error.message.slice(0, 100) : "unknown" });
    }
  }

  const failed = await env.VERIFICACAO_ANUNCIO_DB.prepare(
    "SELECT id FROM verificacao_anuncio_jobs WHERE estado = 'em_analise' AND pagamento_estado = 'pago' AND falha_em IS NOT NULL LIMIT 100"
  ).all<{ id: string }>();
  for (const item of failed.results) {
    try { await refundJob(env, await loadJob(env.VERIFICACAO_ANUNCIO_DB, item.id), "falhou_reembolsado", "falha_tecnica_analise"); }
    catch (error) { console.error("verification_scheduled_refund_failed", { jobId: item.id, error: error instanceof Error ? error.message.slice(0, 100) : "unknown" }); }
  }

  const refunded = await env.VERIFICACAO_ANUNCIO_DB.prepare(
    "SELECT id FROM verificacao_anuncio_jobs WHERE estado IN ('falhou_reembolsado', 'sem_upload_reembolsado') LIMIT 100"
  ).all<{ id: string }>();
  for (const item of refunded.results) {
    try {
      const job = await loadJob(env.VERIFICACAO_ANUNCIO_DB, item.id);
      await sendNotification(env, job, "reembolso");
      if (job.estado === "falhou_reembolsado") await sendNotification(env, job, "falha");
    } catch (error) {
      console.error("verification_scheduled_refund_email_failed", { jobId: item.id, error: error instanceof Error ? error.message.slice(0, 100) : "unknown" });
    }
  }

  const cleanup = await env.VERIFICACAO_ANUNCIO_DB.prepare(
    `SELECT id FROM verificacao_anuncio_jobs
     WHERE imagens_apagadas = 0 AND imagens_apagar_em IS NOT NULL AND imagens_apagar_em <= ? LIMIT 100`
  ).bind(now).all<{ id: string }>();
  for (const item of cleanup.results) {
    try { await cleanUploadedImages(env, await loadJob(env.VERIFICACAO_ANUNCIO_DB, item.id)); }
    catch (error) { console.error("verification_scheduled_cleanup_failed", { jobId: item.id, error: error instanceof Error ? error.message.slice(0, 100) : "unknown" }); }
  }

  await env.VERIFICACAO_ANUNCIO_DB.prepare(
    `UPDATE verificacao_anuncio_jobs SET estado = 'expirado', precheck_json = NULL
     WHERE pagamento_estado = 'pendente' AND upload_expira_em IS NOT NULL AND upload_expira_em <= ?`
  ).bind(now).run();

  const expired = await env.VERIFICACAO_ANUNCIO_DB.prepare(
    "SELECT id FROM verificacao_anuncio_jobs WHERE estado = 'entregue' AND expira_em <= ? LIMIT 100"
  ).bind(now).all<{ id: string }>();
  for (const item of expired.results) {
    try { await expireReport(env, await loadJob(env.VERIFICACAO_ANUNCIO_DB, item.id)); }
    catch (error) { console.error("verification_scheduled_expiry_failed", { jobId: item.id, error: error instanceof Error ? error.message.slice(0, 100) : "unknown" }); }
  }
}

async function processMessage(env: WorkerEnv, message: VerificationMessage, attempts: number) {
  if (!message || !uuidPattern.test(message.verificacaoId)) throw new Error("invalid_queue_message");
  const job = await loadJob(env.VERIFICACAO_ANUNCIO_DB, message.verificacaoId);
  if (message.type === "verificacao_anuncio_pagamento_confirmado") {
    await sendNotification(env, job, "recebida");
    return;
  }
  if (message.type === "verificacao_anuncio_precheck") {
    await precheckJob(env, job, attempts);
    return;
  }
  if (message.type === "verificacao_anuncio_meta_purchase") {
    await trackMetaConversion(env, job, "Purchase", `purchase-${job.stripePaymentId || job.id}`, {
      currency: "EUR",
      value: 3.9,
      content_name: "Verificação de Anúncio",
      content_ids: ["verificacao-anuncio"],
      content_type: "product",
      num_items: 1
    }, true);
    return;
  }
  if (message.type !== "verificacao_anuncio_analisar") throw new Error("unknown_queue_message");
  await analyzeJob(env, job, attempts);
}

export default {
  async queue(batch: MessageBatch<VerificationMessage>, env: WorkerEnv) {
    for (const message of batch.messages) {
      try {
        await processMessage(env, message.body, message.attempts || 1);
        message.ack();
      } catch (error) {
        console.error("verification_queue_failed", {
          type: message.body?.type || "unknown",
          jobId: message.body?.verificacaoId || "unknown",
          error: error instanceof Error ? error.message.slice(0, 100) : "unknown"
        });
        message.retry({ delaySeconds: 300 });
      }
    }
  },
  async scheduled(_event: unknown, env: WorkerEnv, controller: ScheduledController) {
    controller.waitUntil(runScheduled(env));
  },
  async fetch(request: Request) {
    if (new URL(request.url).pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    return new Response("Not found", { status: 404 });
  }
};

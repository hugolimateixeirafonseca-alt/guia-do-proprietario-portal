import {
  STRIPE_PRODUCT_KEY,
  StripeIntegrationError,
  retrieveStripeCheckoutSession,
  validatePaidVerificationSession,
  verifyStripeSignature
} from "../../../src/lib/verificacao-anuncio/stripe.mjs";
import {
  PublicVerificationError,
  createPrivateAccess,
  encryptPrivateValue,
  json,
  requireConfiguration,
  safeError,
  type RequestContext
} from "../../lib/verificacao-anuncio";

const HANDLED_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

export const onRequestPost = async ({ request, env }: RequestContext) => {
  let eventId = "";
  try {
    const config = requireConfiguration(env, true);
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_PRICE_ID) {
      throw new PublicVerificationError(503, "webhook_not_configured");
    }
    const payload = await request.text();
    if (new TextEncoder().encode(payload).byteLength > 512 * 1024) {
      throw new PublicVerificationError(413, "payload_too_large");
    }
    const event = await verifyStripeSignature({
      payload,
      header: request.headers.get("Stripe-Signature") || "",
      secret: env.STRIPE_WEBHOOK_SECRET
    });
    eventId = event.id;
    if (!HANDLED_EVENTS.has(event.type) || event?.data?.object?.metadata?.produto !== STRIPE_PRODUCT_KEY) {
      return json({ received: true });
    }

    const now = new Date().toISOString();
    const existing = await config.db.prepare(
      "SELECT estado, atualizado_em AS atualizadoEm FROM verificacao_anuncio_stripe_events WHERE event_id = ? LIMIT 1"
    ).bind(event.id).first<{ estado: string; atualizadoEm: string }>();
    if (existing?.estado === "completed") return json({ received: true, duplicate: true });
    if (existing?.estado === "processing" && Date.now() - Date.parse(existing.atualizadoEm) < 60_000) {
      throw new PublicVerificationError(503, "webhook_already_processing");
    }
    if (existing) {
      await config.db.prepare(
        "UPDATE verificacao_anuncio_stripe_events SET estado = 'processing', atualizado_em = ?, erro = NULL WHERE event_id = ?"
      ).bind(now, event.id).run();
    } else {
      await config.db.prepare(
        `INSERT INTO verificacao_anuncio_stripe_events
          (event_id, tipo, estado, recebido_em, atualizado_em)
         VALUES (?, ?, 'processing', ?, ?)`
      ).bind(event.id, event.type, now, now).run();
    }

    const eventSessionId = String(event?.data?.object?.id || "");
    const session = await retrieveStripeCheckoutSession({ apiKey: env.STRIPE_SECRET_KEY, sessionId: eventSessionId });
    const paid = validatePaidVerificationSession(session, env.STRIPE_PRICE_ID);
    const verificationId = String(session?.metadata?.verificacao_id || "");
    let job = await config.db.prepare(
      `SELECT id, precheck_estado AS precheckEstado, ficheiros_json AS ficheirosJson
       FROM verificacao_anuncio_jobs WHERE stripe_session_id = ? OR id = ? LIMIT 1`
    ).bind(session.id, verificationId).first<{ id: string; precheckEstado: string; ficheirosJson: string | null }>();

    if (!job) {
      const access = await createPrivateAccess(config.secret);
      const jobId = crypto.randomUUID();
      const createdAt = new Date();
      const uploadExpiresAt = new Date(createdAt.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();
      const reportExpiresAt = new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const inserted = await config.db.prepare(
        `INSERT OR IGNORE INTO verificacao_anuncio_jobs
          (id, access_token_hash, access_token_cipher, stripe_session_id, stripe_payment_id,
           email_cipher, estado, criado_em, upload_expira_em, expira_em)
         VALUES (?, ?, ?, ?, ?, ?, 'aguarda_upload', ?, ?, ?)`
      ).bind(
        jobId,
        access.tokenHash,
        access.tokenCipher,
        session.id,
        paid.paymentIntent,
        await encryptPrivateValue(paid.email, config.secret),
        createdAt.toISOString(),
        uploadExpiresAt,
        reportExpiresAt
      ).run();
      job = (inserted.meta?.changes || 0) === 1
        ? { id: jobId, precheckEstado: "nao_aplicavel", ficheirosJson: null }
        : await config.db.prepare(
          "SELECT id, precheck_estado AS precheckEstado, ficheiros_json AS ficheirosJson FROM verificacao_anuncio_jobs WHERE stripe_session_id = ? LIMIT 1"
        ).bind(session.id).first<{ id: string; precheckEstado: string; ficheirosJson: string | null }>();
    }
    if (!job) throw new PublicVerificationError(500, "job_creation_failed");

    const isPrechecked = job.precheckEstado === "completed" && Boolean(job.ficheirosJson);
    if (isPrechecked) {
      await config.db.prepare(
        `UPDATE verificacao_anuncio_jobs
         SET stripe_session_id = ?, stripe_payment_id = ?, email_cipher = ?, pagamento_estado = 'pago',
             falha_em = NULL, falha_motivo = NULL, processamento_bloqueado_em = NULL
         WHERE id = ?`
      ).bind(session.id, paid.paymentIntent, await encryptPrivateValue(paid.email, config.secret), job.id).run();
      await config.queue!.send({ type: "verificacao_anuncio_analisar", verificacaoId: job.id });
    } else {
      await config.queue!.send({ type: "verificacao_anuncio_pagamento_confirmado", verificacaoId: job.id });
    }
    await config.queue!.send({ type: "verificacao_anuncio_meta_purchase", verificacaoId: job.id });
    await config.db.prepare(
      `INSERT INTO verificacao_anuncio_events (job_id, tipo, estado, criado_em)
       VALUES (?, 'pagamento_confirmado', 'success', ?)`
    ).bind(job.id, now).run();
    await config.db.prepare(
      `UPDATE verificacao_anuncio_stripe_events
       SET estado = 'completed', job_id = ?, atualizado_em = ?, processado_em = ? WHERE event_id = ?`
    ).bind(job.id, now, now, event.id).run();
    return json({ received: true });
  } catch (error) {
    if (eventId && env.VERIFICACAO_ANUNCIO_DB) {
      try {
        await env.VERIFICACAO_ANUNCIO_DB.prepare(
          "UPDATE verificacao_anuncio_stripe_events SET estado = 'error', erro = ?, atualizado_em = ? WHERE event_id = ?"
        ).bind(error instanceof Error ? error.message.slice(0, 100) : "unknown", new Date().toISOString(), eventId).run();
      } catch { /* a repetição do webhook continua disponível */ }
    }
    if (error instanceof StripeIntegrationError) {
      return safeError(new PublicVerificationError(503, "stripe_event_not_processed"));
    }
    return safeError(error);
  }
};

import { retrieveStripeCheckoutSession, validatePaidVerificationSession, StripeIntegrationError } from "../../../src/lib/verificacao-anuncio/stripe.mjs";
import {
  PublicVerificationError,
  checkRateLimit,
  decryptPrivateValue,
  encryptPrivateValue,
  json,
  requireConfiguration,
  safeError,
  type RequestContext
} from "../../lib/verificacao-anuncio";

export const onRequestGet = async ({ request, env }: RequestContext) => {
  try {
    const config = requireConfiguration(env);
    await checkRateLimit(request, config.db, `${config.secret}:confirmation`, 30);
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID || !env.VERIFICACAO_ANUNCIO_QUEUE) {
      throw new PublicVerificationError(503, "confirmation_unavailable");
    }
    const sessionId = new URL(request.url).searchParams.get("session_id") || "";
    const session = await retrieveStripeCheckoutSession({ apiKey: env.STRIPE_SECRET_KEY, sessionId });
    const paid = validatePaidVerificationSession(session, env.STRIPE_PRICE_ID);
    const verificationId = String(session?.metadata?.verificacao_id || "");
    const row = await config.db.prepare(
      `SELECT id, access_token_cipher AS accessTokenCipher, email_cipher AS emailCipher,
        precheck_estado AS precheckEstado, ficheiros_json AS ficheirosJson,
        pagamento_estado AS pagamentoEstado
       FROM verificacao_anuncio_jobs
       WHERE id = ? OR stripe_session_id = ? LIMIT 1`
    ).bind(verificationId, sessionId).first<{
      id: string;
      accessTokenCipher: string;
      emailCipher: string;
      precheckEstado: string;
      ficheirosJson: string | null;
      pagamentoEstado: string;
    }>();
    if (!row?.accessTokenCipher) return json({ ok: true, ready: false }, 202);

    if (row.pagamentoEstado !== "pago") {
      const encryptedEmail = await encryptPrivateValue(paid.email, config.secret);
      const updated = await config.db.prepare(
        `UPDATE verificacao_anuncio_jobs
         SET stripe_session_id = ?, stripe_payment_id = ?, email_cipher = ?, pagamento_estado = 'pago',
             falha_em = NULL, falha_motivo = NULL, processamento_bloqueado_em = NULL
         WHERE id = ? AND pagamento_estado = 'pendente'`
      ).bind(sessionId, paid.paymentIntent, encryptedEmail, row.id).run();

      if ((updated.meta?.changes || 0) === 1) {
        try {
          const isPrechecked = row.precheckEstado === "completed" && Boolean(row.ficheirosJson);
          await env.VERIFICACAO_ANUNCIO_QUEUE.send({
            type: isPrechecked ? "verificacao_anuncio_analisar" : "verificacao_anuncio_pagamento_confirmado",
            verificacaoId: row.id
          });
          await config.db.prepare(
            `INSERT INTO verificacao_anuncio_events (job_id, tipo, estado, detalhe, criado_em)
             VALUES (?, 'pagamento_confirmado_recuperado', 'success', ?, ?)`
          ).bind(row.id, JSON.stringify({ origem: "confirmacao_stripe" }), new Date().toISOString()).run();
        } catch (error) {
          await config.db.prepare(
            `UPDATE verificacao_anuncio_jobs
             SET pagamento_estado = 'pendente', stripe_payment_id = NULL, email_cipher = ?
             WHERE id = ? AND pagamento_estado = 'pago' AND stripe_payment_id = ?`
          ).bind(row.emailCipher, row.id, paid.paymentIntent).run();
          throw error;
        }
      }
    }

    const token = await decryptPrivateValue(row.accessTokenCipher, config.secret);
    return json({ ok: true, ready: true, nextUrl: `/verificacao/enviar/?t=${encodeURIComponent(token)}` });
  } catch (error) {
    if (error instanceof StripeIntegrationError) return safeError(new PublicVerificationError(400, "payment_not_confirmed"));
    return safeError(error);
  }
};

import {
  createStripeCheckoutSession,
  retrieveStripeCheckoutSession,
  StripeIntegrationError
} from "../../../src/lib/verificacao-anuncio/stripe.mjs";
import {
  PublicVerificationError,
  checkRateLimit,
  decryptPrivateValue,
  ensureSameOrigin,
  findVerification,
  json,
  requireConfiguration,
  safeError,
  sendVerificationMetaConversion,
  type RequestContext
} from "../../lib/verificacao-anuncio";

async function trackCheckout(
  request: Request,
  env: RequestContext["env"],
  db: ReturnType<typeof requireConfiguration>["db"],
  row: Awaited<ReturnType<typeof findVerification>>["row"],
  sessionId: string
) {
  try {
    const result = await sendVerificationMetaConversion(env, row, {
      eventName: "InitiateCheckout",
      eventId: `checkout-${sessionId}`,
      request,
      customData: {
        currency: "EUR",
        value: 3.9,
        content_name: "Verificação de Anúncio",
        content_ids: ["verificacao-anuncio"],
        content_type: "product",
        num_items: 1
      }
    });
    await db.prepare(
      `INSERT INTO verificacao_anuncio_events (job_id, tipo, estado, detalhe, criado_em)
       VALUES (?, 'meta_initiate_checkout', ?, ?, ?)`
    ).bind(row.id, result.sent ? "success" : "ignored", JSON.stringify(result), new Date().toISOString()).run();
  } catch (error) {
    await db.prepare(
      `INSERT INTO verificacao_anuncio_events (job_id, tipo, estado, detalhe, criado_em)
       VALUES (?, 'meta_initiate_checkout', 'error', ?, ?)`
    ).bind(row.id, JSON.stringify({ reason: error instanceof Error ? error.message.slice(0, 100) : "unknown" }), new Date().toISOString()).run().catch(() => undefined);
  }
}

export const onRequestPost = async (context: RequestContext) => {
  const { request, env } = context;
  try {
    ensureSameOrigin(request);
    const config = requireConfiguration(env);
    await checkRateLimit(request, config.db, config.secret, 10);
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID || !env.SITE_URL) {
      throw new PublicVerificationError(503, "checkout_not_configured");
    }
    if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
      throw new PublicVerificationError(415, "invalid_content_type");
    }
    const declaredLength = Number(request.headers.get("Content-Length") || "0");
    if (declaredLength > 1024) throw new PublicVerificationError(413, "payload_too_large");
    let body: Record<string, unknown>;
    try { body = JSON.parse(await request.text()); } catch { throw new PublicVerificationError(400, "invalid_payload"); }
    if (typeof body.company === "string" && body.company.trim()) throw new PublicVerificationError(400, "invalid_payload");
    const token = typeof body.token === "string" ? body.token : "";
    const { row } = await findVerification(config.db, token);
    if (row.precheckEstado !== "completed") throw new PublicVerificationError(409, "precheck_not_ready");
    if (row.pagamentoEstado === "pago") throw new PublicVerificationError(409, "payment_already_completed");
    let teaser: { useful?: boolean } = {};
    try { teaser = JSON.parse(row.precheckJson || "{}")?.teaser || {}; } catch { /* validado abaixo */ }
    if (!teaser.useful) throw new PublicVerificationError(409, "captures_not_sufficient");
    const email = await decryptPrivateValue(row.emailCipher, config.secret);
    if (row.stripeSessionId) {
      try {
        const existingSession = await retrieveStripeCheckoutSession({
          apiKey: env.STRIPE_SECRET_KEY,
          sessionId: row.stripeSessionId
        });
        const existingUrl = new URL(String(existingSession?.url || ""));
        if (existingSession?.status === "open" && existingUrl.protocol === "https:" && existingUrl.hostname === "checkout.stripe.com") {
          const trackTask = trackCheckout(request, env, config.db, row, row.stripeSessionId);
          if (context.waitUntil) context.waitUntil(trackTask); else await trackTask;
          return json({ ok: true, url: existingUrl.toString(), reused: true });
        }
      } catch (error) {
        if (!(error instanceof StripeIntegrationError)) throw error;
      }
    }
    const session = await createStripeCheckoutSession({
      apiKey: env.STRIPE_SECRET_KEY,
      priceId: env.STRIPE_PRICE_ID,
      siteUrl: env.SITE_URL,
      attemptId: body.attemptId,
      verificationId: row.id,
      customerEmail: email,
      cancelToken: token
    });
    await config.db.prepare(
      `UPDATE verificacao_anuncio_jobs SET stripe_session_id = ?
       WHERE id = ? AND pagamento_estado = 'pendente'`
    ).bind(session.id, row.id).run();
    const trackTask = trackCheckout(request, env, config.db, row, session.id);
    if (context.waitUntil) context.waitUntil(trackTask); else await trackTask;
    return json({ ok: true, url: session.url });
  } catch (error) {
    if (error instanceof StripeIntegrationError) {
      return safeError(new PublicVerificationError(error.status >= 400 && error.status < 500 ? 400 : 503, "checkout_unavailable"));
    }
    return safeError(error);
  }
};


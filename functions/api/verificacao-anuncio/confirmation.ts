import { retrieveStripeCheckoutSession, validatePaidVerificationSession, StripeIntegrationError } from "../../../src/lib/verificacao-anuncio/stripe.mjs";
import {
  PublicVerificationError,
  checkRateLimit,
  decryptPrivateValue,
  json,
  requireConfiguration,
  safeError,
  type RequestContext
} from "../../lib/verificacao-anuncio";

export const onRequestGet = async ({ request, env }: RequestContext) => {
  try {
    const config = requireConfiguration(env);
    await checkRateLimit(request, config.db, `${config.secret}:confirmation`, 30);
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) throw new PublicVerificationError(503, "confirmation_unavailable");
    const sessionId = new URL(request.url).searchParams.get("session_id") || "";
    const session = await retrieveStripeCheckoutSession({ apiKey: env.STRIPE_SECRET_KEY, sessionId });
    validatePaidVerificationSession(session, env.STRIPE_PRICE_ID);
    const verificationId = String(session?.metadata?.verificacao_id || "");
    const row = await config.db.prepare(
      `SELECT access_token_cipher AS accessTokenCipher
       FROM verificacao_anuncio_jobs
       WHERE (id = ? OR stripe_session_id = ?) AND pagamento_estado = 'pago' LIMIT 1`
    ).bind(verificationId, sessionId).first<{ accessTokenCipher: string }>();
    if (!row?.accessTokenCipher) return json({ ok: true, ready: false }, 202);
    const token = await decryptPrivateValue(row.accessTokenCipher, config.secret);
    return json({ ok: true, ready: true, nextUrl: `/verificacao/enviar/?t=${encodeURIComponent(token)}` });
  } catch (error) {
    if (error instanceof StripeIntegrationError) return safeError(new PublicVerificationError(400, "payment_not_confirmed"));
    return safeError(error);
  }
};

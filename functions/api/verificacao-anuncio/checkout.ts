import { createStripeCheckoutSession, StripeIntegrationError } from "../../../src/lib/verificacao-anuncio/stripe.mjs";
import {
  PublicVerificationError,
  checkRateLimit,
  ensureSameOrigin,
  json,
  requireConfiguration,
  safeError,
  type RequestContext
} from "../../lib/verificacao-anuncio";

export const onRequestPost = async ({ request, env }: RequestContext) => {
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
    const session = await createStripeCheckoutSession({
      apiKey: env.STRIPE_SECRET_KEY,
      priceId: env.STRIPE_PRICE_ID,
      siteUrl: env.SITE_URL,
      attemptId: body.attemptId
    });
    return json({ ok: true, url: session.url });
  } catch (error) {
    if (error instanceof StripeIntegrationError) {
      return safeError(new PublicVerificationError(error.status >= 400 && error.status < 500 ? 400 : 503, "checkout_unavailable"));
    }
    return safeError(error);
  }
};


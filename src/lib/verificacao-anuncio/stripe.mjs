const STRIPE_API_BASE = "https://api.stripe.com/v1";
export const STRIPE_PRODUCT_KEY = "verificacao_anuncio_v1";
export const VERIFICATION_PRICE_CENTS = 390;

export class StripeIntegrationError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = "StripeIntegrationError";
    this.code = code;
    this.status = status;
  }
}

const clean = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";

function validPriceId(value) {
  return /^price_[A-Za-z0-9]{8,100}$/u.test(clean(value, 120));
}

function validSecretKey(value) {
  return /^sk_(test|live)_[A-Za-z0-9_]{12,}$/u.test(clean(value, 512));
}

function trustedSiteUrl(value) {
  let url;
  try {
    url = new URL(clean(value, 500));
  } catch {
    throw new StripeIntegrationError("invalid_site_url");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new StripeIntegrationError("invalid_site_url");
  }
  return url.origin;
}

export function buildCheckoutParameters({ priceId, siteUrl, attemptId, verificationId = "", customerEmail = "", cancelToken = "" }) {
  if (!validPriceId(priceId)) throw new StripeIntegrationError("invalid_price_id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(clean(attemptId, 80))) {
    throw new StripeIntegrationError("invalid_checkout_attempt");
  }
  const origin = trustedSiteUrl(siteUrl);
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("payment_method_types[0]", "card");
  body.set("line_items[0][price]", priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("locale", "pt");
  body.set("client_reference_id", attemptId);
  body.set("metadata[produto]", STRIPE_PRODUCT_KEY);
  body.set("payment_intent_data[metadata][produto]", STRIPE_PRODUCT_KEY);
  if (verificationId) {
    if (!/^[0-9a-f-]{36}$/iu.test(clean(verificationId, 80))) throw new StripeIntegrationError("invalid_verification_id");
    body.set("metadata[verificacao_id]", verificationId);
    body.set("payment_intent_data[metadata][verificacao_id]", verificationId);
  }
  const email = clean(customerEmail, 254).toLowerCase();
  if (email) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) throw new StripeIntegrationError("invalid_customer_email");
    body.set("customer_email", email);
  }
  body.set("success_url", `${origin}/verificacao/confirmacao/?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", cancelToken
    ? `${origin}/verificacao/enviar/?t=${encodeURIComponent(clean(cancelToken, 160))}&pagamento=cancelado`
    : `${origin}/verificacao-anuncio/?pagamento=cancelado#comprar`);
  return body;
}

export async function createStripeCheckoutSession({ apiKey, priceId, siteUrl, attemptId, verificationId, customerEmail, cancelToken, fetchImpl = fetch }) {
  if (!validSecretKey(apiKey)) throw new StripeIntegrationError("invalid_stripe_key");
  const response = await fetchImpl(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: buildCheckoutParameters({ priceId, siteUrl, attemptId, verificationId, customerEmail, cancelToken }).toString(),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new StripeIntegrationError(`checkout_${response.status}`, response.status);
  const session = await response.json();
  const id = clean(session?.id, 120);
  const urlValue = clean(session?.url, 2048);
  let url;
  try { url = new URL(urlValue); } catch { throw new StripeIntegrationError("invalid_checkout_response"); }
  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/u.test(id) || url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") {
    throw new StripeIntegrationError("invalid_checkout_response");
  }
  return { id, url: url.toString() };
}

export async function retrieveStripeCheckoutSession({ apiKey, sessionId, fetchImpl = fetch }) {
  if (!validSecretKey(apiKey)) throw new StripeIntegrationError("invalid_stripe_key");
  const id = clean(sessionId, 180);
  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/u.test(id)) throw new StripeIntegrationError("invalid_session_id");
  const url = new URL(`${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(id)}`);
  url.searchParams.append("expand[]", "line_items");
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new StripeIntegrationError(`session_${response.status}`, response.status);
  return response.json();
}

export function validatePaidVerificationSession(session, expectedPriceId) {
  const lines = session?.line_items?.data;
  const email = clean(session?.customer_details?.email, 254).toLowerCase();
  const paymentIntent = typeof session?.payment_intent === "string" ? session.payment_intent : clean(session?.payment_intent?.id, 120);
  if (session?.metadata?.produto !== STRIPE_PRODUCT_KEY) throw new StripeIntegrationError("wrong_product");
  if (session?.mode !== "payment" || session?.payment_status !== "paid") throw new StripeIntegrationError("payment_not_confirmed");
  if (session?.currency !== "eur" || session?.amount_total !== VERIFICATION_PRICE_CENTS) {
    throw new StripeIntegrationError("wrong_payment_amount");
  }
  if (!Array.isArray(lines) || lines.length !== 1 || lines[0]?.price?.id !== expectedPriceId || lines[0]?.quantity !== 1) {
    throw new StripeIntegrationError("wrong_line_item");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) throw new StripeIntegrationError("customer_email_missing");
  if (!/^pi_[A-Za-z0-9_]+$/u.test(paymentIntent)) throw new StripeIntegrationError("payment_intent_missing");
  return { email, paymentIntent };
}

const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

function constantTimeHexEqual(left, right) {
  if (!/^[a-f0-9]{64}$/iu.test(left) || !/^[a-f0-9]{64}$/iu.test(right)) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyStripeSignature({ payload, header, secret, now = Date.now(), toleranceSeconds = 300 }) {
  const signingSecret = clean(secret, 512);
  if (!/^whsec_[A-Za-z0-9_]+$/u.test(signingSecret)) throw new StripeIntegrationError("invalid_webhook_secret");
  const parts = clean(header, 4096).split(",").map((part) => part.trim());
  const timestamp = Number(parts.find((part) => part.startsWith("t="))?.slice(2));
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!Number.isInteger(timestamp) || signatures.length === 0) throw new StripeIntegrationError("invalid_webhook_signature");
  if (Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds) throw new StripeIntegrationError("expired_webhook_signature");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = hex(new Uint8Array(digest));
  if (!signatures.some((signature) => constantTimeHexEqual(expected, signature))) {
    throw new StripeIntegrationError("invalid_webhook_signature");
  }
  let event;
  try { event = JSON.parse(payload); } catch { throw new StripeIntegrationError("invalid_webhook_payload"); }
  if (!/^evt_[A-Za-z0-9_]+$/u.test(clean(event?.id, 180)) || typeof event?.type !== "string") {
    throw new StripeIntegrationError("invalid_webhook_event");
  }
  return event;
}

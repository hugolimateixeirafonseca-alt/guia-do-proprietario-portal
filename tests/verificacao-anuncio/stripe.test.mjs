import assert from "node:assert/strict";
import test from "node:test";
import {
  StripeIntegrationError,
  VERIFICATION_PRICE_CENTS,
  buildCheckoutParameters,
  createStripeCheckoutSession,
  validatePaidVerificationSession,
  verifyStripeSignature
} from "../../src/lib/verificacao-anuncio/stripe.mjs";

const priceId = "price_1234567890";
const attemptId = "c5ec1ee9-05a7-4cd9-88fc-879f57ce6d35";
const apiKey = "sk_test_1234567890abcdef";

test("cria um checkout único com o preço configurado e regressos no domínio oficial", () => {
  const body = buildCheckoutParameters({ priceId, siteUrl: "https://guiadoproprietario.pt/ignorado", attemptId });
  assert.equal(body.get("mode"), "payment");
  assert.equal(body.get("line_items[0][price]"), priceId);
  assert.equal(body.get("line_items[0][quantity]"), "1");
  assert.equal(body.get("success_url"), "https://guiadoproprietario.pt/verificacao/confirmacao/?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(body.get("cancel_url"), "https://guiadoproprietario.pt/verificacao-anuncio/?pagamento=cancelado#comprar");
});

test("liga o pagamento ao pedido pré-verificado e regressa à ligação privada se for cancelado", () => {
  const token = "a".repeat(43);
  const body = buildCheckoutParameters({
    priceId,
    siteUrl: "https://guiadoproprietario.pt",
    attemptId,
    verificationId: attemptId,
    customerEmail: "cliente@example.com",
    cancelToken: token
  });
  assert.equal(body.get("metadata[verificacao_id]"), attemptId);
  assert.equal(body.get("customer_email"), "cliente@example.com");
  assert.equal(body.get("cancel_url"), `https://guiadoproprietario.pt/verificacao/enviar/?t=${token}&pagamento=cancelado`);
});

test("aceita apenas uma resposta de checkout alojada pela Stripe", async () => {
  const session = await createStripeCheckoutSession({
    apiKey,
    priceId,
    siteUrl: "https://guiadoproprietario.pt",
    attemptId,
    fetchImpl: async () => new Response(JSON.stringify({
      id: "cs_test_1234567890",
      url: "https://checkout.stripe.com/c/pay/cs_test_1234567890"
    }), { status: 200 })
  });
  assert.equal(session.id, "cs_test_1234567890");

  await assert.rejects(createStripeCheckoutSession({
    apiKey,
    priceId,
    siteUrl: "https://guiadoproprietario.pt",
    attemptId,
    fetchImpl: async () => new Response(JSON.stringify({
      id: "cs_test_1234567890",
      url: "https://example.org/pagamento"
    }), { status: 200 })
  }), (error) => error instanceof StripeIntegrationError && error.code === "invalid_checkout_response");
});

test("confirma produto, estado, preço, moeda, email e pagamento antes de criar o pedido", () => {
  assert.equal(VERIFICATION_PRICE_CENTS, 390);
  const paid = validatePaidVerificationSession({
    id: "cs_test_1234567890",
    metadata: { produto: "verificacao_anuncio_v1" },
    mode: "payment",
    payment_status: "paid",
    currency: "eur",
    amount_total: VERIFICATION_PRICE_CENTS,
    payment_intent: "pi_1234567890",
    customer_details: { email: "Cliente@Example.com" },
    line_items: { data: [{ quantity: 1, price: { id: priceId } }] }
  }, priceId);
  assert.deepEqual(paid, { email: "cliente@example.com", paymentIntent: "pi_1234567890" });
});

test("recusa um pagamento com valor diferente da oferta de 3,90 €", () => {
  assert.throws(() => validatePaidVerificationSession({
    metadata: { produto: "verificacao_anuncio_v1" },
    mode: "payment",
    payment_status: "paid",
    currency: "eur",
    amount_total: 790,
    payment_intent: "pi_1234567890",
    customer_details: { email: "cliente@example.com" },
    line_items: { data: [{ quantity: 1, price: { id: priceId } }] }
  }, priceId), (error) => error instanceof StripeIntegrationError && error.code === "wrong_payment_amount");
});

async function stripeHeader(payload, secret, timestamp) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const signature = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${signature}`;
}

test("valida a assinatura Stripe sobre o corpo original e rejeita eventos antigos", async () => {
  const secret = "whsec_1234567890abcdef";
  const timestamp = 1_800_000_000;
  const payload = JSON.stringify({ id: "evt_1234567890", type: "checkout.session.completed" });
  const header = await stripeHeader(payload, secret, timestamp);
  const event = await verifyStripeSignature({ payload, header, secret, now: timestamp * 1000 });
  assert.equal(event.id, "evt_1234567890");
  await assert.rejects(
    verifyStripeSignature({ payload, header, secret, now: (timestamp + 301) * 1000 }),
    (error) => error instanceof StripeIntegrationError && error.code === "expired_webhook_signature"
  );
});

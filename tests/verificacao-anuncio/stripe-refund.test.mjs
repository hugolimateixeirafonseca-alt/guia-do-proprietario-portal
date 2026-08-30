import assert from "node:assert/strict";
import test from "node:test";
import { createStripeRefund } from "../../src/lib/verificacao-anuncio/stripe-refund.mjs";

test("o reembolso Stripe é total, idempotente e ligado ao pedido", async () => {
  let request;
  const result = await createStripeRefund({
    apiKey: "sk_test_1234567890abcdef",
    paymentIntent: "pi_1234567890",
    jobId: "c5ec1ee9-05a7-4cd9-88fc-879f57ce6d35",
    reason: "falha_tecnica_analise",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ id: "re_1234567890", status: "succeeded" }), { status: 200 });
    }
  });
  assert.deepEqual(result, { id: "re_1234567890", status: "succeeded" });
  assert.equal(request.url, "https://api.stripe.com/v1/refunds");
  assert.equal(request.init.headers["Idempotency-Key"], "verificacao-anuncio-refund-c5ec1ee9-05a7-4cd9-88fc-879f57ce6d35");
  const body = new URLSearchParams(request.init.body);
  assert.equal(body.get("payment_intent"), "pi_1234567890");
  assert.equal(body.has("amount"), false);
  assert.equal(body.get("metadata[motivo_interno]"), "falha_tecnica_analise");
});

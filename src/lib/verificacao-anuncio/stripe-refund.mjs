import { StripeIntegrationError } from "./stripe.mjs";

const validSecretKey = (value) => /^sk_(test|live)_[A-Za-z0-9_]{12,}$/u.test(String(value ?? "").trim());

export async function createStripeRefund({ apiKey, paymentIntent, jobId, reason, fetchImpl = fetch }) {
  if (!validSecretKey(apiKey)) throw new StripeIntegrationError("invalid_stripe_key");
  if (!/^pi_[A-Za-z0-9_]+$/u.test(String(paymentIntent ?? ""))) throw new StripeIntegrationError("invalid_payment_intent");
  if (!/^[0-9a-f-]{36}$/iu.test(String(jobId ?? ""))) throw new StripeIntegrationError("invalid_refund_job");
  const body = new URLSearchParams();
  body.set("payment_intent", paymentIntent);
  body.set("reason", "requested_by_customer");
  body.set("metadata[verificacao_id]", jobId);
  body.set("metadata[motivo_interno]", String(reason ?? "falha_tecnica").slice(0, 100));
  const response = await fetchImpl("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `verificacao-anuncio-refund-${jobId}`
    },
    body: body.toString(),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new StripeIntegrationError(`refund_${response.status}`, response.status);
  const refund = await response.json();
  if (!/^re_[A-Za-z0-9_]+$/u.test(String(refund?.id ?? "")) || !["pending", "succeeded"].includes(refund?.status)) {
    throw new StripeIntegrationError("invalid_refund_response");
  }
  return { id: refund.id, status: refund.status };
}

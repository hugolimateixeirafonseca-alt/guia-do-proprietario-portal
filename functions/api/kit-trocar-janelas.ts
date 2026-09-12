import { KIT_JANELAS_CONSENT_VERSION } from "../../src/data/consent";
import { checkRateLimit, logEvent, sha256, PublicError, type D1Database } from "../lib/kit-estudante";
import { createSenderTransactionalClient, SenderTransactionalError } from "../../src/lib/verificacao-anuncio/sender-email.mjs";

interface Env {
  SENDER_API_TOKEN?: string;
  SENDER_GROUP_MARKETING?: string;
  SENDER_TRANSACTIONAL_FROM_EMAIL?: string;
  SENDER_TRANSACTIONAL_FROM_NAME?: string;
  KIT_ESTUDANTE_DB?: D1Database;
  SESSION_SECRET?: string;
}
const PDF_URL = "https://guiadoproprietario.pt/downloads/kit-trocar-janelas-2026.pdf";
const PAGE_URL = "https://guiadoproprietario.pt/kit-trocar-janelas/";
const SOURCE = "kit-trocar-janelas";
const json = (body: object, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const safe = (value: unknown, max: number) => typeof value === "string" && value.length <= max ? value.trim() : "";

class MarketingError extends Error {
  constructor(readonly code: string) { super(code); }
}

async function registerMarketing(env: Env, email: string, requestId: string, date: string) {
  const headers = { Authorization: "Bearer " + env.SENDER_API_TOKEN, Accept: "application/json", "Content-Type": "application/json" };
  const api = async (path: string, method: string, body?: object) => {
    const response = await fetch("https://api.sender.net/v2" + path, {
      method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000)
    });
    // Libertar a ligação antes de iniciar o próximo pedido no Worker.
    await response.body?.cancel();
    return response;
  };
  const identifier = encodeURIComponent(email);
  const fields = {
    "{$CONSENT_DATA}": date, "{$CONSENT_VERSAO}": KIT_JANELAS_CONSENT_VERSION,
    "{$CONSENT_MARKETING}": "true", "{$CONSENT_PUBLICIDADE}": "true",
    "{$ORIGEM}": PAGE_URL, "{$LEAD_SOURCE}": SOURCE, "{$EVENT_ID}": requestId
  };
  const lookup = await api("/subscribers/" + identifier, "GET");
  const group = env.SENDER_GROUP_MARKETING || "egK8WG";
  if (!lookup.ok && lookup.status !== 404) throw new MarketingError("marketing_lookup_" + lookup.status);
  const writeSubscriber = async (path: string, method: string, payload: Record<string, unknown>) => {
    let response = await api(path, method, payload);
    // O consentimento comercial principal mantém-se mesmo se o campo adicional ainda não existir.
    if (!response.ok && (response.status === 400 || response.status === 422)) {
      const { "{$CONSENT_PUBLICIDADE}": _advertising, ...requiredFields } = fields;
      response = await api(path, method, { ...payload, fields: requiredFields });
    }
    return response;
  };
  let response = await writeSubscriber(lookup.ok ? "/subscribers/" + identifier : "/subscribers", lookup.ok ? "PATCH" : "POST",
    lookup.ok ? { fields, trigger_automation: false } : { email, fields, groups: [group], trigger_automation: false });
  if (!response.ok && response.status === 409) {
    response = await writeSubscriber("/subscribers/" + identifier, "PATCH", { fields, trigger_automation: false });
  }
  if (!response.ok) throw new MarketingError("marketing_save_" + response.status);
  const membership = await api("/subscribers/groups/" + encodeURIComponent(group), "POST", {
    subscribers: [email], trigger_automation: false
  });
  if (!membership.ok) throw new MarketingError("marketing_group_" + membership.status);
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "invalid_origin" }, 403);
  if (!request.headers.get("Content-Type")?.includes("application/json")) return json({ error: "invalid" }, 400);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: "invalid" }, 400);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "invalid" }, 400);
    body = parsed;
  } catch { return json({ error: "invalid" }, 400); }
  const email = safe(body.email, 254).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "invalid_email" }, 400);
  if (body.consent1 !== true) return json({ error: "invalid_consent" }, 400);
  if (body.consentVersion !== KIT_JANELAS_CONSENT_VERSION || body.source !== SOURCE ||
    (body.consent2 !== true && body.consent2 !== false) || safe(body.company, 120) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(safe(body.eventId, 36))) {
    return json({ error: "invalid" }, 400);
  }
  const db = env.KIT_ESTUDANTE_DB;
  if (!db || !env.SESSION_SECRET || !env.SENDER_API_TOKEN) return json({ error: "not_configured" }, 503);
  const requestId = body.eventId as string;
  const marketing = body.consent2 === true;
  let ipHash = "";
  let emailHash = "";
  try {
    emailHash = await sha256(env.SESSION_SECRET + ":kit-janelas-email:" + email);
    const completed = await db.prepare(
      "SELECT id FROM kit_events WHERE source = ? AND event = 'janelas_pdf_sent' AND request_id = ? AND session_hash = ? AND status = 'success' LIMIT 1"
    ).bind(SOURCE, requestId, emailHash).first();
    if (completed) return json({ ok: true });
    ipHash = await checkRateLimit(request, db, env.SESSION_SECRET + ":kit-janelas-ip", 6);
    const recipientRequest = new Request(request.url, { headers: { "CF-Connecting-IP": emailHash } });
    await checkRateLimit(recipientRequest, db, env.SESSION_SECRET + ":kit-janelas-recipient", 3);
    const date = new Date().toISOString();
    await logEvent(db, {
      source: SOURCE, event: "janelas_pdf_requested", status: "received", requestId, ipHash, sessionHash: emailHash,
      consentVersion: KIT_JANELAS_CONSENT_VERSION, field: "consents",
      value: JSON.stringify({ delivery: true, marketing })
    });
    // Só a segunda escolha autoriza a inscrição. Uma caixa vazia não altera subscrições anteriores.
    if (marketing) {
      await registerMarketing(env, email, requestId, date);
      await logEvent(db, { source: SOURCE, event: "janelas_marketing_registered", status: "success",
        requestId, ipHash, sessionHash: emailHash, consentVersion: KIT_JANELAS_CONSENT_VERSION });
    }
    const client = createSenderTransactionalClient({ apiToken: env.SENDER_API_TOKEN, sendTimeoutMs: 45_000 });
    await client.send({
      to: email,
      fromEmail: env.SENDER_TRANSACTIONAL_FROM_EMAIL || "geral@guiadoproprietario.pt",
      fromName: env.SENDER_TRANSACTIONAL_FROM_NAME || "Guia do Proprietário",
      subject: "O seu kit para trocar janelas em 2026",
      html: '<!doctype html><html lang="pt-PT"><body style="margin:0;background:#f7f4e9;color:#203f35;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:30px 16px"><table role="presentation" width="100%" style="max-width:580px;background:#fff;border-radius:16px"><tr><td style="padding:35px"><p style="font-size:12px;letter-spacing:2px">GUIA DO PROPRIETÁRIO · CASA E OBRAS</p><h1 style="font-family:Georgia,serif;font-size:34px;line-height:1.2">Escolha as suas próximas janelas com mais confiança.</h1><p style="line-height:1.7">Aqui está o PDF <strong>Trocar Janelas em 2026</strong> que pediu. São 12 páginas com orientações práticas e uma checklist de 17 pontos para comparar propostas antes de decidir.</p><p style="margin:28px 0"><a href="' + PDF_URL + '" style="display:inline-block;background:#20503e;color:#fff;text-decoration:none;border-radius:10px;padding:17px 24px;font-weight:bold">ABRIR O MEU KIT GRÁTIS</a></p><p style="line-height:1.7">Pode guardar o PDF no telemóvel ou imprimir a checklist para usar quando pedir orçamentos. O ficheiro segue também em anexo.</p><p style="border-top:1px solid #e6e9e1;padding-top:20px;font-size:12px;line-height:1.6;color:#6b7870">Recebe este email porque pediu o kit no Guia do Proprietário. <a href="https://guiadoproprietario.pt/privacidade/" style="color:#38634b">Política de Privacidade</a>.</p></td></tr></table></td></tr></table></body></html>',
      text: "Aqui está o PDF Trocar Janelas em 2026 que pediu.\n\n12 páginas e uma checklist de 17 pontos para escolher bem e comparar propostas.\n\nAbrir e guardar o kit: " + PDF_URL + "\n\nO ficheiro segue também em anexo. Recebe este email porque pediu o kit no Guia do Proprietário.\nPolítica de Privacidade: https://guiadoproprietario.pt/privacidade/",
      attachmentUrl: PDF_URL, attachmentName: "Trocar-Janelas-2026.pdf"
    });
    await logEvent(db, { source: SOURCE, event: "janelas_pdf_sent", status: "success", requestId, ipHash,
      sessionHash: emailHash, consentVersion: KIT_JANELAS_CONSENT_VERSION });
    return json({ ok: true });
  } catch (error) {
    const publicCode = error instanceof PublicError ? error.publicCode
      : error instanceof SenderTransactionalError && error.code === "send_timeout" ? "delivery_unconfirmed" : "delivery_failed";
    const diagnosticCode = error instanceof MarketingError || error instanceof SenderTransactionalError
      ? error.code : publicCode;
    try {
      await logEvent(db, { source: SOURCE, event: "janelas_pdf_error", status: "error", requestId, ipHash,
        sessionHash: emailHash, consentVersion: KIT_JANELAS_CONSENT_VERSION, error: diagnosticCode });
    } catch { /* Não guardar contactos nem a resposta do fornecedor em logs públicos. */ }
    return json({ error: publicCode }, error instanceof PublicError ? error.status : 502);
  }
};

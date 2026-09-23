import { enqueuePdf, processPdfJob } from "./pdf-delivery-queue.mjs";
import { reserveSenderRequest, pauseSender, recordSenderRateLimit } from "./sender-api-control.mjs";
import { providerRetryAfter } from "./partner-email-delivery.mjs";
import { recordConsent, openRecord } from "./consent-archive.mjs";
import { CONSENT_TEXT, type ConsentVersion } from "../../src/data/consent";
import { checkRateLimit, logEvent, sha256, PublicError, type D1Database } from "./kit-estudante";
import { createSenderTransactionalClient, SenderTransactionalError } from "../../src/lib/verificacao-anuncio/sender-email.mjs";
import { buildMetaAttribution } from "../../src/lib/meta-conversions.mjs";
import { deliverKitRegistration, kitMetaFailureCode } from "../../src/lib/kit-janelas-meta-delivery.mjs";
import { kitMeasurement } from "../../src/lib/kit-janelas-measurement.mjs";
import { copyLegacyKitEvents } from "../../src/lib/kit-janelas-history.mjs";

interface Env {
  CONSENT_ARCHIVE_DB?: unknown;
  EMAIL_DELIVERY_DB?: D1Database;
  CONSENT_ARCHIVE_KEY?: string;
  SENDER_API_TOKEN?: string;
  SENDER_GROUP_MARKETING?: string;
  SENDER_TRANSACTIONAL_FROM_EMAIL?: string;
  SENDER_TRANSACTIONAL_FROM_NAME?: string;
  KIT_JANELAS_DB?: D1Database;
  PDF_CASA_BANHO_DB?: D1Database;
  KIT_ESTUDANTE_DB?: D1Database; // Ponte de leitura do histórico. Nunca escrever aqui.
  SESSION_SECRET?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_DATASET_ID?: string;
  META_GRAPH_VERSION?: string;
  META_TEST_EVENT_CODE?: string;
}
interface PdfOptinConfig {
  source: string; pageUrl: string; consentVersion: ConsentVersion;
  dbBinding: 'KIT_JANELAS_DB' | 'PDF_CASA_BANHO_DB';
  eventPrefix: string; registrationPrefix: string; hashPrefix: string;
  extraGroups?: string[]; legacyHistory?: boolean;
  message: { subject: string; html: string; text: string; attachmentUrl: string; attachmentName: string };
}
export function createPdfOptinHandler(config: PdfOptinConfig) {
const SOURCE = config.source;
const PAGE_URL = config.pageUrl;
const CONSENT_VERSION = config.consentVersion;
const json = (body: object, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const safe = (value: unknown, max: number) => typeof value === "string" && value.length <= max ? value.trim() : "";

class MarketingError extends Error {
  constructor(readonly code: string, readonly status = 0, readonly retryAfter = 0) { super(code); }
}

async function registerMarketing(env: Env, email: string, requestId: string, date: string, advertising: boolean, ip: string) {
  const headers = { Authorization: "Bearer " + env.SENDER_API_TOKEN, Accept: "application/json", "Content-Type": "application/json" };
  const api = async (path: string, method: string, body?: object) => {
    await reserveSenderRequest(env.EMAIL_DELIVERY_DB);
    const response = await fetch("https://api.sender.net/v2" + path, {
      method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000)
    });
    if(response.status===429){
      await recordSenderRateLimit(env.EMAIL_DELIVERY_DB,response,method==='GET'?'lookup':'write');
      const retryAfter=Math.max(60,providerRetryAfter(response.headers));
      await pauseSender(env.EMAIL_DELIVERY_DB,retryAfter);
      await response.body?.cancel();
      throw new MarketingError("marketing_rate_limited",429,retryAfter);
    }
    // Consumir a resposta liberta a ligação e permite confirmar grupos já existentes.
    const payload = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload };

  };
  const identifier = encodeURIComponent(email);
  const fields = {
    "{$CONSENT_IP}": ip, "{$CONSENT_DATA}": date, "{$CONSENT_VERSAO}": CONSENT_VERSION,
    "{$CONSENT_MARKETING}": "true", ...(advertising ? { "{$CONSENT_PUBLICIDADE}": "true" } : {}),
    "{$ORIGEM}": PAGE_URL, "{$LEAD_SOURCE}": SOURCE, "{$EVENT_ID}": requestId
  };
  const lookup = await api("/subscribers/" + identifier, "GET");
  const groups = [...new Set(["eEvG4m", ...(config.extraGroups || []), ...(advertising ? [env.SENDER_GROUP_MARKETING || "egK8WG"] : [])])];
  const hasGroup = (payload: unknown, group: string) => {
    const tags = (payload as { data?: { subscriber_tags?: { id?: string }[] } } | null)?.data?.subscriber_tags;
    return Array.isArray(tags) && tags.some(tag => tag.id === group);
  };
  if (!lookup.ok && lookup.status !== 404) throw new MarketingError("marketing_lookup_" + lookup.status,lookup.status);
  const writeSubscriber = async (path: string, method: string, payload: Record<string, unknown>) => {
    let response = await api(path, method, payload);
    // O consentimento comercial principal mantém-se mesmo se o campo adicional ainda não existir.
    if (advertising && !response.ok && (response.status === 400 || response.status === 422)) {
      const { "{$CONSENT_PUBLICIDADE}": _advertising, ...requiredFields } = fields;
      response = await api(path, method, { ...payload, fields: requiredFields });
    }
    return response;
  };
  let response = await writeSubscriber(lookup.ok ? "/subscribers/" + identifier : "/subscribers", lookup.ok ? "PATCH" : "POST",
    lookup.ok ? { fields, trigger_automation: false } : { email, fields, groups, trigger_automation: false });
  const createdWithGroup = !lookup.ok && response.ok;
  if (!response.ok && response.status === 409) {
    response = await writeSubscriber("/subscribers/" + identifier, "PATCH", { fields, trigger_automation: false });
  }
  if (!response.ok) throw new MarketingError("marketing_save_" + response.status,response.status);
  // O POST de criação já inclui o grupo. Repeti-lo pode devolver 400 no Sender.
  if (createdWithGroup) return;
  for (const group of groups) {
  if (hasGroup(lookup.payload, group) || hasGroup(response.payload, group)) continue;
  const membership = await api("/subscribers/groups/" + encodeURIComponent(group), "POST", {
    subscribers: [email], trigger_automation: false
  });
  if (!membership.ok) {
    // Duas submissões concorrentes podem associar o mesmo contacto entretanto.
    // Só aceitar a resposta ambígua quando uma releitura confirmar a associação.
    if (membership.status === 400 || membership.status === 409) {
      const confirmed = await api("/subscribers/" + identifier, "GET");
      if (confirmed.ok && hasGroup(confirmed.payload, group)) continue;
    }
    throw new MarketingError("marketing_group_" + membership.status,membership.status);
  }
  }
}

const handler = async ({ request, env, waitUntil }: {
  request: Request; env: Env; waitUntil?: (promise: Promise<unknown>) => void
}) => {
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
  if (body.consentVersion !== CONSENT_VERSION || body.source !== SOURCE ||
    (body.consent2 !== true && body.consent2 !== false) || safe(body.company, 120) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(safe(body.eventId, 36))) {
    return json({ error: "invalid" }, 400);
  }
  const db = env[config.dbBinding];
  if (!db || !env.EMAIL_DELIVERY_DB || !env.SESSION_SECRET || !env.SENDER_API_TOKEN) return json({ error: "not_configured" }, 503);
  const requestId = body.eventId as string;
  const legacy = config.legacyHistory ? env.KIT_ESTUDANTE_DB : undefined;
  if (legacy && waitUntil) {
    waitUntil(copyLegacyKitEvents(legacy, db).catch(() => {
      console.error('kit_janelas_history_import_failed');
    }));
  }
  const marketing = body.consent2 === true;
  const metaEventId = `${config.registrationPrefix}-${requestId}`;
  const attribution = body.metaMeasurement === true && kitMeasurement(request.headers.get("Cookie") || "")
    ? buildMetaAttribution(request, { fbp: body.metaFbp, fbc: body.metaFbc }) : null;
  let ipHash = "";
  let emailHash = "";
  const completeRegistration = async () => {
    if (!attribution) {
      try {
        await logEvent(db, { source: SOURCE, event: `${config.eventPrefix}_meta_registration`, status: "ignored",
          requestId, error: "measurement_not_authorized" });
      } catch { /* A falta de registo não bloqueia o PDF já enviado. */ }
      return json({ ok: true, delivery: "accepted" });
    }
    const deliver = async () => {
    try {
      const sent = await db.prepare(`SELECT id FROM kit_events WHERE source = ? AND event = '${config.eventPrefix}_meta_registration' AND request_id = ? AND status = 'success' LIMIT 1`)
        .bind(SOURCE, requestId).first();
      if (!sent) {
        const result = await deliverKitRegistration({
          ...attribution, accessToken: env.META_CAPI_ACCESS_TOKEN,
          datasetId: env.META_DATASET_ID, graphVersion: env.META_GRAPH_VERSION,
          testEventCode: env.META_TEST_EVENT_CODE, eventName: "CompleteRegistration",
          eventId: metaEventId, eventSourceUrl: PAGE_URL, email,
          customData: { content_name: SOURCE, content_category: "lead_magnet", status: true }
        });
        await logEvent(db, { source: SOURCE, event: `${config.eventPrefix}_meta_registration`,
          status: result.sent && result.eventsReceived === 1 ? "success" : "ignored", requestId,
          field: "attribution", value: JSON.stringify({ fbc: Boolean(attribution.fbc), fbp: Boolean(attribution.fbp), attempts: result.attempts }),
          consentVersion: "2026-09-01-1", error: result.reason || (result.eventsReceived === 1 ? undefined : "not_accepted") });
      }
    } catch (error) {
      try {
        await logEvent(db, { source: SOURCE, event: `${config.eventPrefix}_meta_registration`, status: "error",
          requestId, error: kitMetaFailureCode(error) });
      } catch { /* A medição não pode transformar um envio concluído num erro. */ }
    }
    };
    // Pages mantém a tarefa viva após a resposta, sem atrasar o agradecimento.
    if (waitUntil) waitUntil(deliver());
    else await deliver();
    return json({ ok: true, delivery: "accepted", metaEventId });
  };
  try {
    emailHash = await sha256(env.SESSION_SECRET + `:${config.hashPrefix}-email:` + email);
    // Evitar reenvio de pedidos concluídos na versão antiga durante a mudança.
    const completedQuery = `SELECT id FROM kit_events WHERE source = ? AND event = '${config.eventPrefix}_pdf_sent' AND request_id = ? AND session_hash = ? AND status = 'success' LIMIT 1`;
    let completed = await db.prepare(completedQuery).bind(SOURCE, requestId, emailHash).first();
    if (!completed && legacy) {
      await copyLegacyKitEvents(legacy, db, requestId);
      completed = await db.prepare(completedQuery).bind(SOURCE, requestId, emailHash).first();
    }
    if (completed) return completeRegistration();
    const queued=await db.prepare('SELECT email_hash,evidence_id FROM pdf_delivery_jobs WHERE request_id=?').bind(requestId).first();
    if(queued){
      if(queued.email_hash!==emailHash)return json({error:'request_conflict'},409);
      const saved=await (env.CONSENT_ARCHIVE_DB as D1Database).prepare('SELECT id,payload FROM consent_evidence WHERE id=?').bind(queued.evidence_id).first();
      if(!saved||(await openRecord(env,saved)).choices.c2!==marketing)return json({error:'request_conflict'},409);
      return completeRegistration();
    }
    ipHash = await checkRateLimit(request, db, env.SESSION_SECRET + `:${config.hashPrefix}-ip`, 6);
    const recipientRequest = new Request(request.url, { headers: { "CF-Connecting-IP": emailHash } });
    await checkRateLimit(recipientRequest, db, env.SESSION_SECRET + `:${config.hashPrefix}-recipient`, 3);
    const evidence = await recordConsent(env, request, {email, eventId:requestId, source:SOURCE,
      version:CONSENT_VERSION, text:CONSENT_TEXT[CONSENT_VERSION],
      choices:{c1:true,c2:marketing},pageUrl:PAGE_URL,urlSource:"server_defined_form"});
    await logEvent(db, {
      source: SOURCE, event: `${config.eventPrefix}_pdf_requested`, status: "received", requestId, ipHash, sessionHash: emailHash,
      consentVersion: CONSENT_VERSION, field: "consents",
      value: JSON.stringify({ delivery: true, newsletter: true, marketing })
    });
    await enqueuePdf(db,evidence,emailHash);
    const delivery=recover(env,requestId).catch(()=>({state:'pending'}));
    if(waitUntil)waitUntil(delivery);
    else await delivery;
    return completeRegistration();
  } catch (error) {
    const publicCode = error instanceof PublicError ? error.publicCode
      : error instanceof SenderTransactionalError && error.code === "send_timeout" ? "delivery_unconfirmed" : "delivery_failed";
    const diagnosticCode = error instanceof MarketingError || error instanceof SenderTransactionalError
      ? error.code : publicCode;
    try {
      await logEvent(db, { source: SOURCE, event: `${config.eventPrefix}_pdf_error`, status: "error", requestId, ipHash,
        sessionHash: emailHash, consentVersion: CONSENT_VERSION, error: diagnosticCode });
    } catch { /* Não guardar contactos nem a resposta do fornecedor em logs públicos. */ }
    return json({ error: publicCode }, error instanceof PublicError ? error.status : 502);
  }
};

async function recover(env: Env, requestId?: string) {
 return processPdfJob(env,config,async(evidence: any,row: any,markSending: ()=>Promise<void>)=>{
  const db=env[config.dbBinding]!;
  try{
    await registerMarketing(env,evidence.email,evidence.event_id,evidence.received_at,evidence.choices.c2===true,evidence.ip||'');
  }catch(error){
    const status=Number((error as any)?.status)||0;
    return {state:status===401||status===403?'failed':'retry',error:error instanceof MarketingError?error.code:'pdf_subscriber_sync_pending',providerStatus:status,retryAfter:(error as any)?.retryAfter||300,status:503};
  }
  await logEvent(db,{source:SOURCE,event:`${config.eventPrefix}_newsletter_registered`,status:'success',requestId:row.request_id,sessionHash:row.email_hash,consentVersion:CONSENT_VERSION});
  if(evidence.choices.c2===true)await logEvent(db,{source:SOURCE,event:`${config.eventPrefix}_marketing_registered`,status:'success',requestId:row.request_id,sessionHash:row.email_hash,consentVersion:CONSENT_VERSION});
  const client=createSenderTransactionalClient({apiToken:env.SENDER_API_TOKEN,sendTimeoutMs:45000,
    fetchImpl:async(url: RequestInfo | URL,init?: RequestInit)=>{
      await reserveSenderRequest(env.EMAIL_DELIVERY_DB);
      await markSending();
      const response=await fetch(url,init);
      if(response.status===429){
        await recordSenderRateLimit(env.EMAIL_DELIVERY_DB,response,'email');
        const retryAfter=Math.max(60,providerRetryAfter(response.headers));
        await pauseSender(env.EMAIL_DELIVERY_DB,retryAfter);
        await response.body?.cancel();
        throw new MarketingError('pdf_email_rate_limited',429,retryAfter);
      }
      return response;
    }});
  try{
    await client.send({to:evidence.email,fromEmail:env.SENDER_TRANSACTIONAL_FROM_EMAIL||'geral@guiadoproprietario.pt',fromName:env.SENDER_TRANSACTIONAL_FROM_NAME||'Guia do Proprietário',...config.message});
  }catch(error){
    if((error as any)?.status===429)return {state:'retry',error:'pdf_email_rate_limited',providerStatus:429,retryAfter:(error as any).retryAfter,status:503};
    // The request might have been delivered before a timeout or 5xx response.
    return {state:'uncertain',error:'pdf_email_requires_review',status:503};
  }
  await logEvent(db,{source:SOURCE,event:`${config.eventPrefix}_pdf_sent`,status:'success',requestId:row.request_id,sessionHash:row.email_hash,consentVersion:CONSENT_VERSION});
  return {state:'sent'};
 },requestId);
}
async function backfill(env: Env,evidence: any){
 if(evidence.source!==SOURCE||evidence.consent_version!==CONSENT_VERSION||evidence.choices?.c1!==true)return false;
 const db=env[config.dbBinding];if(!db)return false;
 const emailHash=await sha256(env.SESSION_SECRET+`:${config.hashPrefix}-email:`+evidence.email);
 const last=await db.prepare(`SELECT request_id FROM kit_events WHERE source=? AND event='${config.eventPrefix}_pdf_requested' AND session_hash=? ORDER BY occurred_at DESC LIMIT 1`).bind(SOURCE,emailHash).first<any>();
 if(last?.request_id!==evidence.event_id)return false;
 const sent=await db.prepare(`SELECT id FROM kit_events WHERE source=? AND event='${config.eventPrefix}_pdf_sent' AND session_hash=? AND status='success' AND occurred_at>=? LIMIT 1`).bind(SOURCE,emailHash,evidence.received_at).first();
 if(sent)return false;
 // Recover only failures before sending. An ambiguous send needs manual review.
 const safeFailure=await db.prepare(`SELECT id FROM kit_events WHERE source=? AND request_id=? AND event='${config.eventPrefix}_pdf_error' AND error_code LIKE 'marketing_%' LIMIT 1`).bind(SOURCE,evidence.event_id).first();
 if(!safeFailure)return false;
 await enqueuePdf(db,evidence,emailHash);return true;
}
return Object.assign(handler,{recover,backfill});
}

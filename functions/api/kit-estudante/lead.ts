import {
  ALLOWED_CITIES,
  ALLOWED_PHASES,
  ALLOWED_SOURCES,
  CONSENT_VERSION,
  ProviderError,
  PublicError,
  addKitGroup,
  checkRateLimit,
  cleanText,
  cleanupExpiredSessions,
  createOrUpdateKitSubscriber,
  createSession,
  ensureKitGroupMembership,
  isValidEmail,
  json,
  logEvent,
  normalizeEmail,
  readSmallJson,
  requestId,
  requireConfiguration,
  safeErrorResponse,
  sessionCookie,
  upsertLead,
  type RequestContext
} from "../../lib/kit-estudante";
import {
  OFFICIAL_META_DATASET_ID,
  hasMetaMeasurementConsent,
  sendMetaConversion
} from "../../../src/lib/meta-conversions.mjs";

const STUDENT_SENDER_GROUP_ID = "b4wZA2";
const NEWSLETTER_SENDER_GROUP_ID = "egK8WG";

export const onRequestPost = async (context: RequestContext) => {
  const { request, env } = context;
  const reqId = requestId(request);
  let db: ReturnType<typeof requireConfiguration>["db"] | undefined;
  let source = "direto";
  let ipHash = "";
  let leadId: number | null = null;
  let eventRef = reqId;

  try {
    const config = requireConfiguration(env);
    db = config.db;
    const body = await readSmallJson(request);
    eventRef = cleanText(body.eventId, 80) || reqId;

    if (cleanText(body.company, 120)) throw new PublicError(400, "invalid_submission");

    source = ALLOWED_SOURCES.has(cleanText(body.origem, 24)) ? cleanText(body.origem, 24) : "direto";
    const relation = cleanText(body.relacao, 40);
    const allowedRelations = new Set(["pai_mae_encarregado", "estudante", "outro"]);
    if (!allowedRelations.has(relation)) throw new PublicError(400, "invalid_relation");
    const requiresProfile = relation !== "outro";

    const city = cleanText(body.cidade, 24);
    const phase = cleanText(body.fase, 24);
    const email = normalizeEmail(body.email);
    const consentVersion = cleanText(body.consentVersion, 64);
    if (requiresProfile && !ALLOWED_CITIES.has(city)) throw new PublicError(400, "invalid_city");
    if (requiresProfile && !ALLOWED_PHASES.has(phase)) throw new PublicError(400, "invalid_phase");
    if (!isValidEmail(email)) throw new PublicError(400, "invalid_email");
    if (body.consent !== true || consentVersion !== CONSENT_VERSION) {
      throw new PublicError(400, "consent_required");
    }

    ipHash = await checkRateLimit(request, db, config.sessionSecret, 12);
    await logEvent(db, {
      source,
      event: "landing_subscription_received",
      status: "received",
      consentVersion,
      requestId: eventRef,
      ipHash
    });

    const senderFields: Record<string, string> = {
      "{$est_origem}": source,
      "{$est_relacao}": relation
    };
    if (requiresProfile) {
      senderFields["{$est_cidade}"] = city;
      senderFields["{$est_fase}"] = phase;
    }

    const senderEnv = relation === "estudante"
      ? { ...env, SENDER_GROUP_KIT_ESTUDANTE: STUDENT_SENDER_GROUP_ID }
      : env;

    const senderResult = await createOrUpdateKitSubscriber(
      senderEnv,
      email,
      senderFields,
      true,
      relation !== "estudante" ? [NEWSLETTER_SENDER_GROUP_ID] : []
    );

    if (!senderResult.created && !senderResult.inGroup) {
      await addKitGroup(senderEnv, email, true);
    }

    if (!senderResult.created && relation !== "estudante") {
      const newsletterEnv = { ...env, SENDER_GROUP_KIT_ESTUDANTE: NEWSLETTER_SENDER_GROUP_ID };
      await ensureKitGroupMembership(newsletterEnv, email, true);
    }

    leadId = await upsertLead(
      db,
      email,
      config.sessionSecret,
      source,
      consentVersion,
      senderResult.contactId
    );

    await logEvent(db, {
      leadId,
      source,
      event: senderResult.created ? "sender_contact_created" : "sender_contact_updated",
      status: "success",
      consentVersion,
      requestId: eventRef,
      ipHash
    });
    await logEvent(db, {
      leadId,
      source,
      event: "sender_group_assigned",
      status: "success",
      consentVersion,
      requestId: eventRef,
      ipHash
    });

    const session = await createSession(db, leadId);
    await logEvent(db, {
      leadId,
      source,
      event: "token_created",
      status: "success",
      consentVersion,
      sessionHash: session.tokenHash,
      requestId: eventRef,
      ipHash
    });

    await cleanupExpiredSessions(db);
    if (body.metaMeasurement === true && hasMetaMeasurementConsent(request)) {
      let eventSourceUrl = new URL(request.url).origin;
      try {
        const declaredUrl = new URL(cleanText(body.eventSourceUrl, 1000));
        if (declaredUrl.origin === new URL(request.url).origin) eventSourceUrl = declaredUrl.toString();
      } catch { /* mantém apenas a origem segura */ }
      const metaTask = (async () => {
        try {
          const conversion = await sendMetaConversion({
            accessToken: env.META_CAPI_ACCESS_TOKEN,
            datasetId: env.META_DATASET_ID || OFFICIAL_META_DATASET_ID,
            graphVersion: env.META_GRAPH_VERSION,
            testEventCode: env.META_TEST_EVENT_CODE,
            eventName: "Lead",
            eventId: eventRef,
            eventSourceUrl,
            email,
            externalId: `kit-lead-${leadId}`,
            fbp: cleanText(body.metaFbp, 240),
            fbc: cleanText(body.metaFbc, 240),
            clientIpAddress: cleanText(request.headers.get("CF-Connecting-IP"), 80),
            clientUserAgent: cleanText(request.headers.get("User-Agent"), 500),
            customData: {
              content_name: "kit_estudante_2026",
              content_category: "lead_magnet"
            }
          });
          await logEvent(db, {
            leadId,
            source,
            event: "meta_lead_conversion",
            status: conversion.sent ? "success" : "ignored",
            error: conversion.sent ? undefined : conversion.reason,
            consentVersion,
            requestId: eventRef,
            ipHash
          });
        } catch (error) {
          await logEvent(db, {
            leadId,
            source,
            event: "meta_lead_conversion",
            status: "error",
            error: error instanceof Error ? error.message.slice(0, 100) : "unknown",
            consentVersion,
            requestId: eventRef,
            ipHash
          }).catch(() => undefined);
        }
      })();
      if (context.waitUntil) context.waitUntil(metaTask);
      else await metaTask;
    }
    return json({ ok: true, redirect: "/kit-estudante/obrigado/" }, 200, {
      "Set-Cookie": sessionCookie(session.token)
    });
  } catch (error) {
    if (db) {
      const errorCode = error instanceof PublicError || error instanceof ProviderError ? error.message : "unknown";
      try {
        await logEvent(db, {
          leadId,
          source,
          event: error instanceof PublicError ? "invalid_payload" : "sender_error",
          status: "error",
          error: errorCode,
          consentVersion: CONSENT_VERSION,
          requestId: eventRef,
          ipHash
        });
      } catch {
        // A resposta ao utilizador não depende do registo de diagnóstico.
      }
    }
    return safeErrorResponse(error);
  }
};

// Deployment binding refresh: Meta Kit Leads 2026-08-24
import {
  ALLOWED_CITIES,
  ALLOWED_PHASES,
  CONSENT_VERSION,
  ProviderError,
  PublicError,
  addKitGroup,
  cleanText,
  createOrUpdateKitSubscriber,
  isQualifiedParentRelation,
  isValidEmail,
  json,
  logEvent,
  normalizeEmail,
  readSmallJson,
  requestId,
  requireConfiguration,
  safeErrorResponse,
  sha256,
  upsertLead,
  type RequestContext
} from "../../lib/kit-estudante";

function secureEqual(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function authorized(request: Request, secret: string) {
  const header = request.headers.get("Authorization") || "";
  return secureEqual(header, `Bearer ${secret}`);
}

function bearerSecret(request: Request) {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function normalizeCity(value: unknown) {
  const normalized = cleanText(value, 80)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const aliases: Record<string, string> = {
    lisboa: "lisboa", porto: "porto", coimbra: "coimbra", braga: "braga",
    aveiro: "aveiro", evora: "evora", faro: "faro", outra: "outra",
    outro: "outra", outras: "outra"
  };
  return aliases[normalized] || "";
}

function normalizePhase(value: unknown) {
  const normalized = cleanText(value, 120)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("a procura") || normalized === "procura") return "procura";
  if (normalized.includes("encontr") || normalized === "encontrou") return "encontrou";
  if (normalized.includes("tratado") || normalized === "tratado") return "tratado";
  return "";
}

export const onRequestPost = async ({ request, env }: RequestContext) => {
  const reqId = requestId(request);
  let db: ReturnType<typeof requireConfiguration>["db"] | undefined;
  let metaLeadId = "";

  try {
    const dedicatedSecret = env.MAKE_META_LEADS_SECRET || "";
    const derivedSecret = env.CLOUDFLARE_API_TOKEN
      ? await sha256(`meta-kit:${env.CLOUDFLARE_API_TOKEN}`)
      : "";
    const expectedSecretHash = (env as typeof env & { MAKE_META_LEADS_SECRET_SHA256?: string })
      .MAKE_META_LEADS_SECRET_SHA256 || "";
    const suppliedSecret = bearerSecret(request);
    const hashAuthorized = expectedSecretHash && suppliedSecret
      ? secureEqual(await sha256(suppliedSecret), expectedSecretHash)
      : false;
    const isAuthorized =
      (dedicatedSecret ? authorized(request, dedicatedSecret) : false)
      || (derivedSecret ? authorized(request, derivedSecret) : false)
      || hashAuthorized;
    if (!isAuthorized) {
      return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    const config = requireConfiguration(env);
    db = config.db;
    const body = await readSmallJson(request, 8192);

    metaLeadId = cleanText(body.leadgen_id ?? body.leadgenId ?? body.id, 100);
    const relation = cleanText(body.relacao_estudante ?? body.relacao ?? body.relationship, 254);
    const email = normalizeEmail(body.email ?? body.email_address);
    const city = normalizeCity(body.cidade ?? body.city);
    const phase = normalizePhase(body.fase ?? body.phase);
    const consent = body.consentimento === true || body.consent === true || body.consentimento_email === true;

    if (!metaLeadId) throw new PublicError(400, "missing_leadgen_id");

    const duplicate = await db.prepare(
      "SELECT id FROM kit_events WHERE meta_lead_id = ? AND event IN ('make_meta_lead_fetched', 'make_meta_lead_disqualified') LIMIT 1"
    ).bind(metaLeadId).first();
    if (duplicate) return json({ ok: true, duplicate: true });

    if (!isQualifiedParentRelation(relation)) {
      await logEvent(db, {
        source: "meta", event: "make_meta_lead_disqualified", status: "ignored",
        error: relation ? "not_parent" : "missing_relation",
        metaLeadId, requestId: reqId
      });
      return json({ ok: true, qualified: false });
    }

    if (!isValidEmail(email)) throw new PublicError(400, "invalid_email");
    if (!consent) throw new PublicError(400, "consent_required");

    const fields: Record<string, string> = {
      "{$est_origem}": "meta",
      "{$est_relacao}": "pai_mae_encarregado"
    };
    if (ALLOWED_CITIES.has(city)) fields["{$est_cidade}"] = city;
    if (ALLOWED_PHASES.has(phase)) fields["{$est_fase}"] = phase;

    const sender = await createOrUpdateKitSubscriber(env, email, fields, true);
    if (!sender.created && !sender.inGroup) await addKitGroup(env, email, true);

    const leadId = await upsertLead(
      db, email, config.sessionSecret, "meta", CONSENT_VERSION, sender.contactId
    );

    await logEvent(db, {
      leadId, source: "meta", event: "make_meta_lead_fetched", status: "success",
      consentVersion: CONSENT_VERSION, metaLeadId, requestId: reqId,
      ipHash: await sha256(`${config.sessionSecret}:make-meta`)
    });

    return json({ ok: true, qualified: true });
  } catch (error) {
    if (db) {
      try {
        await logEvent(db, {
          source: "meta",
          event: "make_meta_lead_error",
          status: "error",
          error: error instanceof Error ? cleanText(error.message, 120) : "unknown",
          metaLeadId: metaLeadId || undefined,
          requestId: reqId
        });
      } catch {}
    }
    return safeErrorResponse(error);
  }
};

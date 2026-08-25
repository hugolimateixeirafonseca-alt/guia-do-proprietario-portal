import {
  ALLOWED_CITIES,
  ALLOWED_PHASES,
  CONSENT_VERSION,
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

const STUDENT_SENDER_GROUP_ID = "b4wZA2";

function secureEqual(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function bearerSecret(request: Request) {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function normalize(value: unknown, max = 254) {
  return cleanText(value, max)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]+/g, " ")
    .trim();
}

function isStudentRelation(value: unknown) {
  const v = normalize(value);
  return v === "estudante"
    || v === "estudante do ensino superior"
    || v === "sou estudante do ensino superior";
}

function normalizeCity(value: unknown) {
  const v = normalize(value, 80);
  const aliases: Record<string, string> = {
    lisboa: "lisboa", porto: "porto", coimbra: "coimbra", braga: "braga",
    aveiro: "aveiro", evora: "evora", faro: "faro", outra: "outra",
    outro: "outra", outras: "outra"
  };
  return aliases[v] || "";
}

function normalizePhase(value: unknown) {
  const v = normalize(value, 160);
  if (v.includes("a procura") || v === "procura") return "procura";
  if (v.includes("encontr") || v === "encontrou") return "encontrou";
  if (v.includes("tratado") || v === "tratado") return "tratado";
  return "";
}

function splitValues(value: unknown) {
  const raw = cleanText(value, 12000);
  if (!raw) return [] as string[];
  return raw.split(/\s*\|\|\|\s*/).map((item) => item.trim()).filter(Boolean).slice(0, 250);
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
    const dedicatedAuthorized = dedicatedSecret
      ? secureEqual(request.headers.get("Authorization") || "", `Bearer ${dedicatedSecret}`)
      : false;
    const derivedAuthorized = derivedSecret
      ? secureEqual(request.headers.get("Authorization") || "", `Bearer ${derivedSecret}`)
      : false;
    if (!dedicatedAuthorized && !derivedAuthorized && !hashAuthorized) {
      return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    const config = requireConfiguration(env);
    db = config.db;
    const body = await readSmallJson(request, 16384);

    metaLeadId = cleanText(body.leadgen_id ?? body.leadgenId ?? body.id, 100);
    if (!metaLeadId) throw new PublicError(400, "missing_leadgen_id");

    const duplicate = await db.prepare(
      "SELECT id FROM kit_events WHERE meta_lead_id = ? AND event = 'make_meta_lead_fetched' LIMIT 1"
    ).bind(metaLeadId).first();
    if (duplicate) return json({ ok: true, duplicate: true });

    const values = splitValues(body.all_values ?? body.values ?? body.form_values);
    let relation = cleanText(body.relacao_estudante ?? body.relacao ?? body.relationship, 254);
    if (!relation) relation = values.find((v) => isQualifiedParentRelation(v) || isStudentRelation(v)) || "";

    let email = normalizeEmail(body.email ?? body.email_address);
    if (!isValidEmail(email)) email = values.map(normalizeEmail).find(isValidEmail) || email;

    let city = normalizeCity(body.cidade ?? body.city);
    if (!city) city = values.map(normalizeCity).find(Boolean) || "";

    let phase = normalizePhase(body.fase ?? body.phase);
    if (!phase) phase = values.map(normalizePhase).find(Boolean) || "";

    const consent = body.consentimento === true || body.consent === true || body.consentimento_email === true;
    let isParent = isQualifiedParentRelation(relation);
    const isStudent = isStudentRelation(relation);

    // Safe fallback: Q2/Q3 only exist on the parent branch. Never infer "student"
    // merely because fields are missing; that would risk misrouting a parent.
    if (!isParent && !isStudent && !relation && (city || phase)) isParent = true;

    if (!isParent && !isStudent) {
      await logEvent(db, {
        source: "meta", event: "make_meta_lead_disqualified", status: "ignored",
        error: relation ? "unsupported_relation" : "missing_relation",
        metaLeadId, requestId: reqId
      });
      return json({ ok: true, qualified: false });
    }

    if (!isValidEmail(email)) throw new PublicError(400, "invalid_email");
    if (!consent) throw new PublicError(400, "consent_required");

    const fields: Record<string, string> = { "{$est_origem}": "meta" };
    if (isParent && ALLOWED_CITIES.has(city)) fields["{$est_cidade}"] = city;
    if (isParent && ALLOWED_PHASES.has(phase)) fields["{$est_fase}"] = phase;

    const senderEnv = isStudent
      ? { ...env, SENDER_GROUP_KIT_ESTUDANTE: STUDENT_SENDER_GROUP_ID }
      : env;
    const sender = await createOrUpdateKitSubscriber(senderEnv, email, fields, true);
    if (!sender.created && !sender.inGroup) await addKitGroup(senderEnv, email, true);

    const leadId = await upsertLead(db, email, config.sessionSecret, "meta", CONSENT_VERSION, sender.contactId);
    const relationValue = isStudent ? "estudante" : "pai_mae_encarregado";

    await logEvent(db, {
      leadId, source: "meta", event: "make_meta_lead_fetched", status: "success",
      field: "est_relacao", value: relationValue,
      consentVersion: CONSENT_VERSION, metaLeadId, requestId: reqId,
      ipHash: await sha256(`${config.sessionSecret}:make-meta`)
    });

    return json({ ok: true, qualified: true, segment: isStudent ? "student" : "parent" });
  } catch (error) {
    if (db) {
      try {
        await logEvent(db, {
          source: "meta", event: "make_meta_lead_error", status: "error",
          error: error instanceof Error ? cleanText(error.message, 120) : "unknown",
          metaLeadId: metaLeadId || undefined, requestId: reqId
        });
      } catch {}
    }
    return safeErrorResponse(error);
  }
};

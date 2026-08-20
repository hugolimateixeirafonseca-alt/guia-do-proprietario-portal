import {
  ALLOWED_CITIES,
  ALLOWED_PHASES,
  ProviderError,
  PublicError,
  checkRateLimit,
  cleanText,
  createOrUpdateKitSubscriber,
  json,
  logEvent,
  readSmallJson,
  requestId,
  requireConfiguration,
  resolveSession,
  safeErrorResponse,
  type RequestContext
} from "../../lib/kit-estudante";

export const onRequestPost = async ({ request, env }: RequestContext) => {
  const reqId = requestId(request);
  let db: ReturnType<typeof requireConfiguration>["db"] | undefined;
  let leadId: number | null = null;
  let sessionHash = "";
  let ipHash = "";

  try {
    const config = requireConfiguration(env);
    db = config.db;
    ipHash = await checkRateLimit(request, db, config.sessionSecret, 30);
    const session = await resolveSession(request, db, config.sessionSecret);
    leadId = session.leadId;
    sessionHash = session.tokenHash;
    const body = await readSmallJson(request);
    const field = cleanText(body.campo, 32);
    const value = cleanText(body.valor, 32);

    const valid = field === "est_cidade"
      ? ALLOWED_CITIES.has(value)
      : field === "est_fase" && ALLOWED_PHASES.has(value);
    if (!valid) throw new PublicError(400, "invalid_profile_value");

    await createOrUpdateKitSubscriber(env, session.email, { [`{$${field}}`]: value }, false);
    await logEvent(db, {
      leadId,
      source: "direto",
      event: field === "est_cidade" ? "profile_city_updated" : "profile_phase_updated",
      field,
      value,
      status: "success",
      sessionHash,
      requestId: reqId,
      ipHash
    });
    return json({ ok: true, next: field === "est_cidade" ? "fase" : "complete" });
  } catch (error) {
    if (db) {
      const errorCode = error instanceof PublicError || error instanceof ProviderError ? error.message : "unknown";
      try {
        await logEvent(db, {
          leadId,
          event: "profile_update_failed",
          status: "error",
          error: errorCode,
          sessionHash,
          requestId: reqId,
          ipHash
        });
      } catch {
        // A resposta ao utilizador não depende do registo de diagnóstico.
      }
    }
    return safeErrorResponse(error);
  }
};


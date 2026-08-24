import {
  ALLOWED_CITIES,
  ALLOWED_PHASES,
  CONSENT_VERSION,
  ProviderError,
  addKitGroup,
  cleanText,
  createOrUpdateKitSubscriber,
  isQualifiedParentRelation,
  isValidEmail,
  json,
  logEvent,
  normalizeEmail,
  requestId,
  requireConfiguration,
  sha256,
  upsertLead,
  type RequestContext
} from "../../lib/kit-estudante";

const encoder = new TextEncoder();

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validSignature(raw: string, signature: string, secret: string) {
  if (!signature.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = `sha256=${hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(raw))))}`;
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
}

function leadIds(payload: unknown) {
  if (!payload || typeof payload !== "object") return [] as string[];
  const entries = Array.isArray((payload as Record<string, unknown>).entry)
    ? (payload as Record<string, unknown>).entry as Array<unknown>
    : [];
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = Array.isArray((entry as Record<string, unknown>).changes)
      ? (entry as Record<string, unknown>).changes as Array<unknown>
      : [];
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as Record<string, unknown>).value;
      if (!value || typeof value !== "object") continue;
      const id = cleanText((value as Record<string, unknown>).leadgen_id, 100);
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)].slice(0, 25);
}

function fieldMap(payload: unknown) {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rows = Array.isArray(record.field_data) ? record.field_data as Array<unknown> : [];
  const result = new Map<string, string>();
  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const item = row as Record<string, unknown>;
    const name = cleanText(item.name, 80).toLowerCase();
    const values = Array.isArray(item.values) ? item.values : [];
    const value = cleanText(values[0], 254);
    if (name && value) result.set(name, value);
  });
  return result;
}

function relationValue(fields: Map<string, string>) {
  const keys = [
    "relacao_estudante",
    "relacao",
    "relationship",
    "qual_destas_opcoes_descreve_melhor_a_sua_relacao_com_o_estudante"
  ];
  for (const key of keys) {
    const value = fields.get(key);
    if (value) return value;
  }
  for (const [key, value] of fields) {
    if ((key.includes("relac") || key.includes("relationship")) && key.includes("estud")) return value;
  }
  return "";
}

function normalizeCity(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const aliases: Record<string, string> = {
    lisboa: "lisboa", porto: "porto", coimbra: "coimbra", braga: "braga",
    aveiro: "aveiro", evora: "evora", faro: "faro", outra: "outra", outro: "outra"
  };
  return aliases[normalized] || "";
}

function normalizePhase(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("a procura") || normalized === "procura") return "procura";
  if (normalized.includes("encontr") || normalized === "encontrou") return "encontrou";
  if (normalized.includes("tratado") || normalized === "tratado") return "tratado";
  return "";
}

async function fetchMetaLead(leadId: string, token: string, version: string) {
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(leadId)}`);
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new ProviderError(`meta_graph_${response.status}`);
  return response.json();
}

export const onRequestGet = async ({ request, env }: RequestContext) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") || "";
  if (mode === "subscribe" && env.META_VERIFY_TOKEN && token === env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response("Forbidden", { status: 403 });
};

export const onRequestPost = async ({ request, env }: RequestContext) => {
  const reqId = requestId(request);
  try {
    const config = requireConfiguration(env);
    if (!env.META_APP_SECRET || !env.META_PAGE_ACCESS_TOKEN || !env.META_VERIFY_TOKEN || !env.META_GRAPH_VERSION) {
      throw new ProviderError("meta_configuration_missing");
    }
    const raw = await request.text();
    if (encoder.encode(raw).byteLength > 65_536) return json({ error: "payload_too_large" }, 413);
    if (!await validSignature(raw, request.headers.get("X-Hub-Signature-256") || "", env.META_APP_SECRET)) {
      return json({ error: "invalid_signature" }, 401);
    }
    const payload = JSON.parse(raw) as unknown;
    const ids = leadIds(payload);
    await logEvent(config.db, { source: "meta", event: "meta_webhook_received", status: "received", requestId: reqId });

    for (const metaLeadId of ids) {
      const duplicate = await config.db.prepare(
        "SELECT id FROM kit_events WHERE meta_lead_id = ? AND event IN ('meta_lead_fetched', 'meta_lead_disqualified') LIMIT 1"
      ).bind(metaLeadId).first();
      if (duplicate) continue;

      const lead = await fetchMetaLead(metaLeadId, env.META_PAGE_ACCESS_TOKEN, env.META_GRAPH_VERSION);
      const fields = fieldMap(lead);
      const relation = relationValue(fields);
      if (!isQualifiedParentRelation(relation)) {
        await logEvent(config.db, {
          source: "meta", event: "meta_lead_disqualified", status: "ignored",
          error: relation ? "not_parent" : "missing_relation", metaLeadId, requestId: reqId
        });
        continue;
      }

      const email = normalizeEmail(fields.get("email") || fields.get("email_address") || fields.get("e-mail"));
      if (!isValidEmail(email)) {
        await logEvent(config.db, {
          source: "meta", event: "invalid_payload", status: "error", error: "invalid_email",
          metaLeadId, requestId: reqId
        });
        continue;
      }

      const city = normalizeCity(fields.get("cidade") || fields.get("city") || fields.get("onde_vai_o_seu_filho_estudar") || "");
      const phase = normalizePhase(fields.get("fase") || fields.get("phase") || fields.get("em_que_ponto_esta_a_procura") || "");
      const senderFields: Record<string, string> = { "{$est_origem}": "meta" };
      if (ALLOWED_CITIES.has(city)) senderFields["{$est_cidade}"] = city;
      if (ALLOWED_PHASES.has(phase)) senderFields["{$est_fase}"] = phase;

      const senderResult = await createOrUpdateKitSubscriber(env, email, senderFields, true);
      if (!senderResult.created && !senderResult.inGroup) await addKitGroup(env, email, true);
      const leadId = await upsertLead(
        config.db, email, config.sessionSecret, "meta", CONSENT_VERSION, senderResult.contactId
      );
      await logEvent(config.db, {
        leadId, source: "meta", event: "meta_lead_fetched", status: "success",
        consentVersion: CONSENT_VERSION, metaLeadId, requestId: reqId,
        ipHash: await sha256(`${config.sessionSecret}:meta`)
      });
    }

    return json({ ok: true });
  } catch (error) {
    return json({ error: "service_unavailable" }, 503);
  }
};

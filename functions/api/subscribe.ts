import { CONSENT_TEXT, type ConsentVersion } from "../../src/data/consent";

interface Env {
  SENDER_API_TOKEN?: string;
  SENDER_GROUP_MARKETING?: string;
  SENDER_GROUP_GUIA_VENDER_CASA?: string;
  SENDER_GROUP_GUIA_PARCEIROS?: string;
}

interface SubscribeBody {
  email?: unknown;
  consent1?: unknown;
  consent2?: unknown;
  consentVersion?: unknown;
  source?: unknown;
  pageUrl?: unknown;
  eventId?: unknown;
  phone?: unknown;
  postalCode?: unknown;
  name?: unknown;
  saleTimeline?: unknown;
}

interface RequestContext {
  request: Request;
  env: Env;
}

const SENDER_API = "https://api.sender.net/v2";
const GEO_API = "https://json.geoapi.pt/codigo_postal";
const DEFAULT_GROUPS = {
  newsletter: "egK8WG",
  guiaVenderCasa: "dJAl59",
  guiaParceiros: "aKBm4l"
} as const;

const SALE_TIMELINES = {
  selling_now: "Já estou a tentar vender",
  within_3_months: "Nos próximos 3 meses",
  "3_to_12_months": "Entre 3 e 12 meses",
  value_only: "Só quero saber o valor, sem intenção de vender para já"
} as const;

const json = (body: object, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizePostalCode = (value: unknown) => {
  const digits = cleanText(value, 16).replace(/\D/g, "").slice(0, 7);
  return digits.length === 7 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : "";
};

type PostalLookup =
  | { status: "found"; locality: string }
  | { status: "not_found"; locality: "" }
  | { status: "unavailable"; locality: "Por confirmar" };

async function lookupPostalCode(postalCode: string): Promise<PostalLookup> {
  try {
    const response = await fetch(`${GEO_API}/${encodeURIComponent(postalCode)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000)
    });
    if (response.status === 404) return { status: "not_found", locality: "" };
    if (!response.ok) return { status: "unavailable", locality: "Por confirmar" };

    const data = await response.json() as { Localidade?: unknown; Concelho?: unknown };
    const locality = cleanText(data.Localidade || data.Concelho, 120);
    return locality
      ? { status: "found", locality }
      : { status: "unavailable", locality: "Por confirmar" };
  } catch {
    return { status: "unavailable", locality: "Por confirmar" };
  }
}

class SenderError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function senderRequest(env: Env, path: string, init: RequestInit = {}) {
  return fetch(`${SENDER_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.SENDER_API_TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers
    }
  });
}

async function createOrUpdateSubscriber(
  env: Env,
  email: string,
  fields: Record<string, string>,
  groupIds: string[],
  triggerAutomation: boolean,
  phone = "",
  firstname = ""
) {
  const hasLocationFields = "{$CODIGO_POSTAL}" in fields || "{$LOCALIDADE}" in fields;
  const fieldsWithoutOptionalProfile = { ...fields };
  delete fieldsWithoutOptionalProfile["{$CODIGO_POSTAL}"];
  delete fieldsWithoutOptionalProfile["{$LOCALIDADE}"];
  delete fieldsWithoutOptionalProfile["{$PRAZO_VENDA}"];

  const writeSubscriber = async (path: string, method: "POST" | "PATCH", payload: Record<string, unknown>) => {
    let response = await senderRequest(env, path, { method, body: JSON.stringify(payload) });
    let locationStored = hasLocationFields;

    // A lead não se perde se os dois campos personalizados ainda não existirem no Sender.
    if (!response.ok && hasLocationFields && (response.status === 400 || response.status === 422)) {
      response = await senderRequest(env, path, {
        method,
        body: JSON.stringify({ ...payload, fields: fieldsWithoutOptionalProfile })
      });
      locationStored = false;
    }

    return { response, locationStored };
  };

  const identifier = encodeURIComponent(email);
  const existing = await senderRequest(env, `/subscribers/${identifier}`, { method: "GET" });

  if (existing.ok) {
    const updated = await writeSubscriber(`/subscribers/${identifier}`, "PATCH", {
      fields,
      ...(phone ? { phone } : {}),
      ...(firstname ? { firstname } : {}),
      trigger_automation: false
    });
    if (!updated.response.ok) throw new SenderError(`update_${updated.response.status}`);
    return { created: false, locationStored: updated.locationStored };
  }

  if (existing.status !== 404) throw new SenderError(`lookup_${existing.status}`);

  const created = await writeSubscriber("/subscribers", "POST", {
    email,
    groups: groupIds,
    fields,
    ...(phone ? { phone } : {}),
    ...(firstname ? { firstname } : {}),
    trigger_automation: triggerAutomation
  });

  if (created.response.ok) return { created: true, locationStored: created.locationStored };

  // Protege contra duas submissões simultâneas do mesmo endereço.
  if (created.response.status === 409) {
    const updated = await writeSubscriber(`/subscribers/${identifier}`, "PATCH", {
      fields,
      ...(phone ? { phone } : {}),
      ...(firstname ? { firstname } : {}),
      trigger_automation: false
    });
    if (updated.response.ok) return { created: false, locationStored: updated.locationStored };
  }

  throw new SenderError(`create_${created.response.status}`);
}

async function addSubscriberToGroup(env: Env, groupId: string, email: string, triggerAutomation: boolean) {
  const response = await senderRequest(env, `/subscribers/groups/${encodeURIComponent(groupId)}`, {
    method: "POST",
    body: JSON.stringify({ subscribers: [email], trigger_automation: triggerAutomation })
  });
  if (!response.ok) throw new SenderError(`group_${response.status}`);
}

export const onRequestPost = async ({ request, env }: RequestContext) => {
  let body: SubscribeBody;
  try {
    body = await request.json() as SubscribeBody;
  } catch {
    return json({ error: "invalid" }, 400);
  }

  const email = cleanText(body.email, 254).toLowerCase();
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const consentVersion = cleanText(body.consentVersion, 64);
  const consentText = CONSENT_TEXT[consentVersion as ConsentVersion];
  const source = body.source === "newsletter" || body.source === "ebook-vender-casa" || body.source === "ebook-vender-casa-partner" ? body.source : "";
  const isPartnerFollowup = source === "ebook-vender-casa-partner";
  const expectedVersion = source === "newsletter" ? "newsletter-2026-08-c" : "2026-08-j";
  const phone = cleanText(body.phone, 32);
  const phoneDigits = phone.replace(/\D/g, "");
  const localPhoneDigits = phoneDigits.startsWith("00351")
    ? phoneDigits.slice(5)
    : phoneDigits.startsWith("351")
      ? phoneDigits.slice(3)
      : phoneDigits;
  const phoneOk = /^9\d{8}$/.test(localPhoneDigits) && !/[^\d+\s()-]/.test(phone);
  const postalCode = normalizePostalCode(body.postalCode);
  const firstname = cleanText(body.name, 80).replace(/\s+/g, " ");
  const nameOk = firstname.length >= 2 && /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(firstname);
  const saleTimelineCode = cleanText(body.saleTimeline, 32) as keyof typeof SALE_TIMELINES;
  const saleTimeline = SALE_TIMELINES[saleTimelineCode] || "";

  if (!emailOk || body.consent1 !== true || !consentText || !source || consentVersion !== expectedVersion) {
    return json({ error: "invalid" }, 400);
  }

  if (isPartnerFollowup) {
    if (body.consent2 !== true) return json({ error: "invalid_consent" }, 400);
    if (!nameOk) return json({ error: "invalid_name" }, 400);
    if (!phoneOk) return json({ error: "invalid_phone" }, 400);
    if (!postalCode) return json({ error: "invalid_postal_code" }, 400);
    if (!saleTimeline) return json({ error: "invalid_sale_timeline" }, 400);
  }

  if (!env.SENDER_API_TOKEN) {
    return json({ error: "not_configured" }, 503);
  }

  const groups = {
    newsletter: env.SENDER_GROUP_MARKETING || DEFAULT_GROUPS.newsletter,
    guiaVenderCasa: env.SENDER_GROUP_GUIA_VENDER_CASA || DEFAULT_GROUPS.guiaVenderCasa,
    guiaParceiros: env.SENDER_GROUP_GUIA_PARCEIROS || DEFAULT_GROUPS.guiaParceiros
  };

  const postalLookup = isPartnerFollowup ? await lookupPostalCode(postalCode) : null;
  if (postalLookup?.status === "not_found") {
    return json({ error: "postal_not_found" }, 400);
  }

  const consentDate = new Date().toISOString();
  const fields = {
    "{$CONSENT_DATA}": consentDate,
    "{$CONSENT_IP}": cleanText(request.headers.get("CF-Connecting-IP"), 64),
    "{$CONSENT_VERSAO}": consentVersion,
    "{$CONSENT_MARKETING}": "true",
    "{$CONSENT_PARCEIROS}": body.consent2 === true ? "true" : "false",
    "{$ORIGEM}": cleanText(body.pageUrl, 2048),
    "{$LEAD_SOURCE}": source,
    "{$EVENT_ID}": cleanText(body.eventId, 128),
    ...(isPartnerFollowup ? {
      "{$CODIGO_POSTAL}": postalCode,
      "{$LOCALIDADE}": postalLookup?.locality || "Por confirmar",
      "{$PRAZO_VENDA}": saleTimeline
    } : {})
  };

  try {
    const subscriberGroups = [
      groups.newsletter,
      ...(body.consent2 === true ? [groups.guiaParceiros] : []),
      ...(source === "ebook-vender-casa" ? [groups.guiaVenderCasa] : [])
    ];
    const subscriberResult = await createOrUpdateSubscriber(
      env,
      email,
      fields,
      subscriberGroups,
      source === "ebook-vender-casa",
      phone,
      firstname
    );

    if (subscriberResult.created) {
      return json({
        ok: true,
        ...(isPartnerFollowup ? { locality: postalLookup?.locality, locationStored: subscriberResult.locationStored } : {})
      }, 200);
    }

    await addSubscriberToGroup(env, groups.newsletter, email, false);

    if (body.consent2 === true) {
      await addSubscriberToGroup(env, groups.guiaParceiros, email, false);
    }

    if (source === "ebook-vender-casa") {
      await addSubscriberToGroup(env, groups.guiaVenderCasa, email, true);
    }

    return json({
      ok: true,
      ...(isPartnerFollowup ? { locality: postalLookup?.locality, locationStored: subscriberResult.locationStored } : {})
    }, 200);
  } catch (error) {
    const code = error instanceof SenderError ? error.code : "unknown";
    return json({ error: "provider_error", code }, 502);
  }
};

import { CONSENT_TEXT, type ConsentVersion } from "../../src/data/consent";

interface Env {
  SENDER_API_TOKEN?: string;
  SENDER_GROUP_NEWSLETTER?: string;
  SENDER_GROUP_GUIA_VENDER_CASA?: string;
  SENDER_GROUP_GUIA_PARCEIROS?: string;
  PARTNER_CONSENT_ENABLED?: string;
}

interface SubscribeBody {
  email?: unknown;
  consent1?: unknown;
  consent2?: unknown;
  consentVersion?: unknown;
  source?: unknown;
  pageUrl?: unknown;
  eventId?: unknown;
}

interface RequestContext {
  request: Request;
  env: Env;
}

const SENDER_API = "https://api.sender.net/v2";
const DEFAULT_GROUPS = {
  newsletter: "eEvG4m",
  guiaVenderCasa: "dJAl59",
  guiaParceiros: "aKBm4l"
} as const;

const json = (body: object, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

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
  triggerAutomation: boolean
) {
  const identifier = encodeURIComponent(email);
  const existing = await senderRequest(env, `/subscribers/${identifier}`, { method: "GET" });

  if (existing.ok) {
    const updated = await senderRequest(env, `/subscribers/${identifier}`, {
      method: "PATCH",
      body: JSON.stringify({ fields, trigger_automation: false })
    });
    if (!updated.ok) throw new SenderError(`update_${updated.status}`);
    return false;
  }

  if (existing.status !== 404) throw new SenderError(`lookup_${existing.status}`);

  const created = await senderRequest(env, "/subscribers", {
    method: "POST",
    body: JSON.stringify({
      email,
      groups: groupIds,
      fields,
      trigger_automation: triggerAutomation
    })
  });

  if (created.ok) return true;

  // Protege contra duas submissões simultâneas do mesmo endereço.
  if (created.status === 409) {
    const updated = await senderRequest(env, `/subscribers/${identifier}`, {
      method: "PATCH",
      body: JSON.stringify({ fields, trigger_automation: false })
    });
    if (updated.ok) return false;
  }

  throw new SenderError(`create_${created.status}`);
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
  const source = body.source === "newsletter" || body.source === "ebook-vender-casa" ? body.source : "";
  const expectedVersion = source === "newsletter" ? "newsletter-2026-08-b" : "2026-08-d";

  if (!emailOk || body.consent1 !== true || !consentText || !source || consentVersion !== expectedVersion) {
    return json({ error: "invalid" }, 400);
  }

  if (!env.SENDER_API_TOKEN) {
    return json({ error: "not_configured" }, 503);
  }

  const partnerConsentEnabled = env.PARTNER_CONSENT_ENABLED === "true";
  if (body.consent2 === true && !partnerConsentEnabled) {
    return json({ error: "partner_consent_unavailable" }, 400);
  }

  const groups = {
    newsletter: env.SENDER_GROUP_NEWSLETTER || DEFAULT_GROUPS.newsletter,
    guiaVenderCasa: env.SENDER_GROUP_GUIA_VENDER_CASA || DEFAULT_GROUPS.guiaVenderCasa,
    guiaParceiros: env.SENDER_GROUP_GUIA_PARCEIROS || DEFAULT_GROUPS.guiaParceiros
  };

  const consentDate = new Date().toISOString();
  const fields = {
    "{$CONSENT_DATA}": consentDate,
    "{$CONSENT_IP}": cleanText(request.headers.get("CF-Connecting-IP"), 64),
    "{$CONSENT_VERSAO}": consentVersion,
    "{$CONSENT_MARKETING}": "true",
    "{$CONSENT_PARCEIROS}": body.consent2 === true ? "true" : "false",
    "{$ORIGEM}": cleanText(body.pageUrl, 2048),
    "{$LEAD_SOURCE}": source,
    "{$EVENT_ID}": cleanText(body.eventId, 128)
  };

  try {
    const subscriberGroups = [
      groups.newsletter,
      ...(body.consent2 === true ? [groups.guiaParceiros] : []),
      ...(source === "ebook-vender-casa" ? [groups.guiaVenderCasa] : [])
    ];
    const created = await createOrUpdateSubscriber(
      env,
      email,
      fields,
      subscriberGroups,
      source === "ebook-vender-casa"
    );

    if (created) {
      return json({ ok: true }, 200);
    }

    await addSubscriberToGroup(env, groups.newsletter, email, false);

    if (body.consent2 === true) {
      await addSubscriberToGroup(env, groups.guiaParceiros, email, false);
    }

    if (source === "ebook-vender-casa") {
      await addSubscriberToGroup(env, groups.guiaVenderCasa, email, true);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    const code = error instanceof SenderError ? error.code : "unknown";
    return json({ error: "provider_error", code }, 502);
  }
};

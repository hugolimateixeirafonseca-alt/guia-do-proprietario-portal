import { CONSENT_TEXT, type ConsentVersion } from "../../src/data/consent";

interface Env {
  SENDER_API_TOKEN?: string;
  SENDER_GROUP_MARKETING?: string;
  SENDER_GROUP_GUIA_VENDER_CASA?: string;
  SENDER_GROUP_GUIA_PARCEIROS?: string;
  SENDER_GROUP_LIMPEZA?: string;
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
  serviceType?: unknown;
  spaceType?: unknown;
  spaceSize?: unknown;
  serviceFrequency?: unknown;
  oneTimeTiming?: unknown;
  preferredDate?: unknown;
  preferredWeekday?: unknown;
  preferredTimePeriod?: unknown;
  additionalNotes?: unknown;
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
  guiaParceiros: "aKBm4l",
  limpeza: "bWv1LJ"
} as const;

const CLEANING_LABELS = {
  serviceType: {
    regular: "Limpeza regular", profunda: "Limpeza profunda", pos_obra: "Limpeza pós-obra",
    mudanca: "Limpeza de mudança", empresarial: "Limpeza de empresa", outra: "Outro serviço"
  },
  spaceType: {
    apartamento: "Apartamento", moradia: "Moradia", escritorio: "Escritório", loja: "Loja",
    alojamento_local: "Alojamento local", outro: "Outro espaço"
  },
  spaceSize: {
    t0_t1: "T0 / T1", t2: "T2", t3: "T3", t4_mais: "T4 ou superior",
    small_space: "Espaço pequeno", medium_space: "Espaço médio", large_space: "Espaço grande",
    unknown: "Não sabe indicar"
  },
  frequency: {
    one_time: "Apenas uma vez", weekly: "Todas as semanas", fortnightly: "De 15 em 15 dias",
    monthly: "Uma vez por mês", undecided: "Frequência por decidir"
  },
  timing: {
    asap: "O mais rápido possível", this_week: "Esta semana", next_week: "Próxima semana",
    specific_date: "Data específica"
  },
  weekday: {
    monday: "Segunda-feira", tuesday: "Terça-feira", wednesday: "Quarta-feira",
    thursday: "Quinta-feira", friday: "Sexta-feira", saturday: "Sábado", flexible: "Dia flexível"
  },
  period: { morning: "Manhã", afternoon: "Tarde", flexible: "Período indiferente" }
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
  const optionalProfileFields = [
    "{$CODIGO_POSTAL}", "{$LOCALIDADE}", "{$PRAZO_VENDA}", "{$LIMPEZA_SERVICO}",
    "{$LIMPEZA_ESPACO}", "{$LIMPEZA_DIMENSAO}", "{$LIMPEZA_FREQUENCIA}",
    "{$LIMPEZA_QUANDO}", "{$LIMPEZA_DATA}", "{$LIMPEZA_DIA}",
    "{$LIMPEZA_PERIODO}", "{$LIMPEZA_NOTAS}", "{$PEDIDO_RESUMO}"
  ];
  const hasOptionalProfileFields = optionalProfileFields.some((field) => field in fields);
  const fieldsWithoutOptionalProfile = { ...fields };
  optionalProfileFields.forEach((field) => delete fieldsWithoutOptionalProfile[field]);

  const writeSubscriber = async (path: string, method: "POST" | "PATCH", payload: Record<string, unknown>) => {
    let response = await senderRequest(env, path, { method, body: JSON.stringify(payload) });
    let locationStored = hasOptionalProfileFields;

    // A lead não se perde se os dois campos personalizados ainda não existirem no Sender.
    if (!response.ok && hasOptionalProfileFields && (response.status === 400 || response.status === 422)) {
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
  const source = body.source === "newsletter" || body.source === "ebook-vender-casa" || body.source === "ebook-vender-casa-partner" || body.source === "valor-liquido-venda-direct" || body.source === "guia_limpeza_preco_disponibilidade" ? body.source : "";
  const isPartnerFollowup = source === "ebook-vender-casa-partner";
  const isDirectValueLead = source === "valor-liquido-venda-direct";
  const isCleaningLead = source === "guia_limpeza_preco_disponibilidade";
  const isQualifiedLead = isPartnerFollowup || isDirectValueLead || isCleaningLead;
  const expectedVersion = source === "newsletter"
    ? "newsletter-2026-08-c"
    : isDirectValueLead
      ? "valor-liquido-2026-08-a"
      : isCleaningLead
        ? "limpeza-2026-08-a"
      : "2026-08-k";
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
  const partnerConsent = isDirectValueLead || isCleaningLead ? body.consent1 === true : body.consent2 === true;
  const marketingConsent = isDirectValueLead || isCleaningLead ? body.consent2 === true : body.consent1 === true;
  const serviceTypeCode = cleanText(body.serviceType, 32) as keyof typeof CLEANING_LABELS.serviceType;
  const spaceTypeCode = cleanText(body.spaceType, 32) as keyof typeof CLEANING_LABELS.spaceType;
  const spaceSizeCode = cleanText(body.spaceSize, 32) as keyof typeof CLEANING_LABELS.spaceSize;
  const frequencyCode = cleanText(body.serviceFrequency, 32) as keyof typeof CLEANING_LABELS.frequency;
  const timingCode = cleanText(body.oneTimeTiming, 32) as keyof typeof CLEANING_LABELS.timing;
  const weekdayCode = cleanText(body.preferredWeekday, 32) as keyof typeof CLEANING_LABELS.weekday;
  const periodCode = cleanText(body.preferredTimePeriod, 32) as keyof typeof CLEANING_LABELS.period;
  const serviceType = CLEANING_LABELS.serviceType[serviceTypeCode] || "";
  const spaceType = CLEANING_LABELS.spaceType[spaceTypeCode] || "";
  const spaceSize = CLEANING_LABELS.spaceSize[spaceSizeCode] || "";
  const serviceFrequency = CLEANING_LABELS.frequency[frequencyCode] || "";
  const oneTimeTiming = CLEANING_LABELS.timing[timingCode] || "";
  const preferredWeekday = CLEANING_LABELS.weekday[weekdayCode] || "";
  const preferredTimePeriod = CLEANING_LABELS.period[periodCode] || "";
  const preferredDate = cleanText(body.preferredDate, 10);
  const additionalNotes = cleanText(body.additionalNotes, 500);

  if (!emailOk) return json({ error: "invalid_email" }, 400);
  if (body.consent1 !== true) return json({ error: "invalid_consent" }, 400);
  if (!consentText || !source || consentVersion !== expectedVersion) {
    return json({ error: "invalid" }, 400);
  }

  if (isQualifiedLead) {
    if (!partnerConsent) return json({ error: "invalid_consent" }, 400);
    if (!nameOk) return json({ error: "invalid_name" }, 400);
    if (!phoneOk) return json({ error: "invalid_phone" }, 400);
    if (!postalCode) return json({ error: "invalid_postal_code" }, 400);
    if (!isCleaningLead && !saleTimeline) return json({ error: "invalid_sale_timeline" }, 400);
  }

  if (isCleaningLead) {
    if (!serviceType) return json({ error: "invalid_service_type" }, 400);
    if (!spaceType) return json({ error: "invalid_space_type" }, 400);
    if (!spaceSize) return json({ error: "invalid_space_size" }, 400);
    if (!serviceFrequency) return json({ error: "invalid_service_frequency" }, 400);
    if (!preferredTimePeriod) return json({ error: "invalid_preferred_time_period" }, 400);
    if (frequencyCode === "one_time" && !oneTimeTiming) return json({ error: "invalid_one_time_timing" }, 400);
    if (frequencyCode === "one_time" && timingCode === "specific_date" && !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      return json({ error: "invalid_preferred_date" }, 400);
    }
    if (["weekly", "fortnightly", "monthly"].includes(frequencyCode) && !preferredWeekday) {
      return json({ error: "invalid_preferred_weekday" }, 400);
    }
  }

  if (!env.SENDER_API_TOKEN) {
    return json({ error: "not_configured" }, 503);
  }

  const groups = {
    newsletter: env.SENDER_GROUP_MARKETING || DEFAULT_GROUPS.newsletter,
    guiaVenderCasa: env.SENDER_GROUP_GUIA_VENDER_CASA || DEFAULT_GROUPS.guiaVenderCasa,
    guiaParceiros: env.SENDER_GROUP_GUIA_PARCEIROS || DEFAULT_GROUPS.guiaParceiros,
    limpeza: env.SENDER_GROUP_LIMPEZA || DEFAULT_GROUPS.limpeza
  };

  const postalLookup = isQualifiedLead ? await lookupPostalCode(postalCode) : null;
  if (postalLookup?.status === "not_found") {
    return json({ error: "postal_not_found" }, 400);
  }

  const consentDate = new Date().toISOString();
  const fields = {
    "{$CONSENT_DATA}": consentDate,
    "{$CONSENT_IP}": cleanText(request.headers.get("CF-Connecting-IP"), 64),
    "{$CONSENT_VERSAO}": consentVersion,
    ...(!isDirectValueLead && !isCleaningLead || marketingConsent ? { "{$CONSENT_MARKETING}": marketingConsent ? "true" : "false" } : {}),
    "{$CONSENT_PARCEIROS}": partnerConsent ? "true" : "false",
    "{$ORIGEM}": cleanText(body.pageUrl, 2048),
    "{$LEAD_SOURCE}": source,
    "{$EVENT_ID}": cleanText(body.eventId, 128),
    ...(isQualifiedLead ? {
      "{$CODIGO_POSTAL}": postalCode,
      "{$LOCALIDADE}": postalLookup?.locality || "Por confirmar",
      ...(!isCleaningLead ? { "{$PRAZO_VENDA}": saleTimeline } : {}),
      ...(isCleaningLead ? {
        "{$LIMPEZA_SERVICO}": serviceType,
        "{$LIMPEZA_ESPACO}": spaceType,
        "{$LIMPEZA_DIMENSAO}": spaceSize,
        "{$LIMPEZA_FREQUENCIA}": serviceFrequency,
        "{$LIMPEZA_QUANDO}": oneTimeTiming,
        "{$LIMPEZA_DATA}": preferredDate,
        "{$LIMPEZA_DIA}": preferredWeekday,
        "{$LIMPEZA_PERIODO}": preferredTimePeriod,
        "{$LIMPEZA_NOTAS}": additionalNotes,
        "{$PEDIDO_RESUMO}": [serviceType, spaceType, spaceSize, serviceFrequency, oneTimeTiming || preferredWeekday, preferredTimePeriod].filter(Boolean).join(" | ")
      } : {})
    } : {})
  };

  try {
    const subscriberGroups = [
      ...(!isDirectValueLead && !isCleaningLead || marketingConsent ? [groups.newsletter] : []),
      ...(partnerConsent && !isCleaningLead ? [groups.guiaParceiros] : []),
      ...(partnerConsent && isCleaningLead ? [groups.limpeza] : []),
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
        ...(isQualifiedLead ? { locality: postalLookup?.locality, locationStored: subscriberResult.locationStored } : {})
      }, 200);
    }

    if (!isDirectValueLead && !isCleaningLead || marketingConsent) {
      await addSubscriberToGroup(env, groups.newsletter, email, false);
    }

    if (partnerConsent && !isCleaningLead) {
      await addSubscriberToGroup(env, groups.guiaParceiros, email, false);
    }

    if (partnerConsent && isCleaningLead) {
      await addSubscriberToGroup(env, groups.limpeza, email, false);
    }

    if (source === "ebook-vender-casa") {
      await addSubscriberToGroup(env, groups.guiaVenderCasa, email, true);
    }

    return json({
      ok: true,
      ...(isQualifiedLead ? { locality: postalLookup?.locality, locationStored: subscriberResult.locationStored } : {})
    }, 200);
  } catch (error) {
    const code = error instanceof SenderError ? error.code : "unknown";
    return json({ error: "provider_error", code }, 502);
  }
};

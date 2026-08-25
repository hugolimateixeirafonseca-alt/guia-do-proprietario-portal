import { CONSENT_TEXT, type ConsentVersion } from "../../src/data/consent";

interface Env {
  SENDER_API_TOKEN?: string;
  SENDER_GROUP_MARKETING?: string;
  SENDER_GROUP_GUIA_VENDER_CASA?: string;
  SENDER_GROUP_GUIA_PARCEIROS?: string;
  CLEANING_DASHBOARD_API_URL?: string;
  CLEANING_DASHBOARD_API_TOKEN?: string;
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
  preferredWeekdays?: unknown;
  preferredTimePeriods?: unknown;
  additionalNotes?: unknown;
  alUnits?: unknown;
  alServices?: unknown;
  alTurnaround?: unknown;
  alAccess?: unknown;
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

const AL_LABELS = {
  units: { "1": "1 alojamento", "2-3": "2 a 3 alojamentos", "4-9": "4 a 9 alojamentos", "10-plus": "10 ou mais alojamentos" },
  service: {
    rotation: "Limpeza entre estadias", laundry: "Roupa de cama e banho",
    consumables: "Reposição de consumíveis", deep: "Limpeza profunda pontual",
    maintenance: "Pequenas reparações"
  },
  turnaround: {
    under_3h: "Menos de 3 horas", "3_5h": "Entre 3 e 5 horas", over_5h: "Mais de 5 horas",
    free_day: "Costuma haver um dia livre", varies: "Varia muito"
  },
  access: {
    lockbox: "Cofre ou código", company_key: "A empresa fica com chave",
    in_person: "Alguém abre a porta", undecided: "Ainda por definir"
  }
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

const cleanChoiceList = (value: unknown, maxItems = 7, maxLength = 32) => {
  const source = Array.isArray(value) ? value : value === undefined || value === null || value === "" ? [] : [value];
  return [...new Set(source.map(item => cleanText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
};

const normalizePostalCode = (value: unknown) => {
  const digits = cleanText(value, 16).replace(/\D/g, "").slice(0, 7);
  return digits.length === 7 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : "";
};

type PostalLookup =
  | { status: "found"; locality: string; municipality: string }
  | { status: "not_found"; locality: ""; municipality: "" }
  | { status: "unavailable"; locality: "Por confirmar"; municipality: "Por confirmar" };

async function lookupPostalCode(postalCode: string): Promise<PostalLookup> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${GEO_API}/${encodeURIComponent(postalCode)}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6500)
      });
      if (response.status === 404) return { status: "not_found", locality: "", municipality: "" };
      if (!response.ok) continue;

      const data = await response.json() as { Localidade?: unknown; Concelho?: unknown };
      const locality = cleanText(data.Localidade || data.Concelho, 120);
      const municipality = cleanText(data.Concelho, 120);
      if (locality && municipality) return { status: "found", locality, municipality };
      return { status: "unavailable", locality: "Por confirmar", municipality: "Por confirmar" };
    } catch {
      // Uma falha transitória não deve fazer perder um pedido válido.
    }
  }
  return { status: "unavailable", locality: "Por confirmar", municipality: "Por confirmar" };
}

async function sendCleaningLead(
  env: Env,
  body: SubscribeBody,
  postalCode: string,
  municipality: string,
  consentText: { readonly c1: string; readonly c2: string }
) {
  if (!env.CLEANING_DASHBOARD_API_TOKEN) return { ok: false, status: 503, code: "not_configured" };
  const endpoint = env.CLEANING_DASHBOARD_API_URL || "https://guia-do-proprietario-parceiros.pages.dev/api/leads";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLEANING_DASHBOARD_API_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event_id: cleanText(body.eventId, 128),
        service_type: cleanText(body.serviceType, 32),
        space_type: cleanText(body.spaceType, 32),
        space_size: cleanText(body.spaceSize, 32),
        postal_code: postalCode,
        municipality,
        service_frequency: cleanText(body.serviceFrequency, 32),
        one_time_timing: cleanText(body.oneTimeTiming, 32),
        preferred_date: cleanText(body.preferredDate, 10),
        preferred_weekdays: cleanChoiceList(body.preferredWeekdays ?? body.preferredWeekday),
        preferred_time_periods: cleanChoiceList(body.preferredTimePeriods ?? body.preferredTimePeriod, 3),
        name: cleanText(body.name, 80),
        phone: cleanText(body.phone, 32),
        email: cleanText(body.email, 254).toLowerCase(),
        additional_notes: cleanText(body.additionalNotes, 500),
        consent_partner_sharing: true,
        consent_partner_sharing_text: consentText.c1,
        consent_marketing: body.consent2 === true,
        consent_marketing_text: body.consent2 === true ? consentText.c2 : "",
        segmento: cleanText(body.source, 64) === "guia_limpeza_alojamento_local" ? "alojamento-local" : "geral",
        al_units: cleanText(body.alUnits, 32),
        al_services: cleanChoiceList(body.alServices, 5),
        al_turnaround: cleanText(body.alTurnaround, 32),
        al_access: cleanText(body.alAccess, 32),
        origem: cleanText(body.source, 64) === "guia_limpeza_alojamento_local" ? "landing-alojamento-local" : "landing-servicos-limpeza"
      })
    });
    return { ok: response.ok, status: response.status, code: response.ok ? "" : `dashboard_${response.status}` };
  } catch {
    return { ok: false, status: 502, code: "dashboard_unavailable" };
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
    "{$LIMPEZA_PERIODO}", "{$LIMPEZA_NOTAS}", "{$PEDIDO_RESUMO}",
    "{$AL_UNIDADES}", "{$AL_SERVICOS}", "{$AL_JANELA}", "{$AL_ACESSO}"
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
  const source = body.source === "newsletter" || body.source === "ebook-vender-casa" || body.source === "ebook-vender-casa-partner" || body.source === "valor-liquido-venda-direct" || body.source === "guia_limpeza_preco_disponibilidade" || body.source === "guia_limpeza_alojamento_local" ? body.source : "";
  const isPartnerFollowup = source === "ebook-vender-casa-partner";
  const isDirectValueLead = source === "valor-liquido-venda-direct";
  const isCleaningAlLead = source === "guia_limpeza_alojamento_local";
  const isCleaningLead = source === "guia_limpeza_preco_disponibilidade" || isCleaningAlLead;
  const isQualifiedLead = isPartnerFollowup || isDirectValueLead || isCleaningLead;
  const expectedVersion = source === "newsletter"
    ? "newsletter-2026-08-c"
    : isDirectValueLead
      ? "valor-liquido-2026-08-a"
      : isCleaningLead
        ? isCleaningAlLead ? "alojamento-local-2026-08-a" : "limpeza-2026-08-b"
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
  const weekdayCodes = cleanChoiceList(body.preferredWeekdays ?? body.preferredWeekday) as Array<keyof typeof CLEANING_LABELS.weekday>;
  const periodCodes = cleanChoiceList(body.preferredTimePeriods ?? body.preferredTimePeriod, 3) as Array<keyof typeof CLEANING_LABELS.period>;
  const serviceType = CLEANING_LABELS.serviceType[serviceTypeCode] || "";
  const spaceType = CLEANING_LABELS.spaceType[spaceTypeCode] || "";
  const spaceSize = CLEANING_LABELS.spaceSize[spaceSizeCode] || "";
  const serviceFrequency = CLEANING_LABELS.frequency[frequencyCode] || "";
  const oneTimeTiming = CLEANING_LABELS.timing[timingCode] || "";
  const preferredWeekdays = weekdayCodes.map(code => CLEANING_LABELS.weekday[code]).filter(Boolean);
  const preferredTimePeriods = periodCodes.map(code => CLEANING_LABELS.period[code]).filter(Boolean);
  const preferredDate = cleanText(body.preferredDate, 10);
  const additionalNotes = cleanText(body.additionalNotes, 500);
  const alUnitsCode = cleanText(body.alUnits, 32) as keyof typeof AL_LABELS.units;
  const alServiceCodes = cleanChoiceList(body.alServices, 5) as Array<keyof typeof AL_LABELS.service>;
  const alTurnaroundCode = cleanText(body.alTurnaround, 32) as keyof typeof AL_LABELS.turnaround;
  const alAccessCode = cleanText(body.alAccess, 32) as keyof typeof AL_LABELS.access;
  const alUnits = AL_LABELS.units[alUnitsCode] || "";
  const alServices = alServiceCodes.map(code => AL_LABELS.service[code]).filter(Boolean);
  const alTurnaround = AL_LABELS.turnaround[alTurnaroundCode] || "";
  const alAccess = AL_LABELS.access[alAccessCode] || "";

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
    if (isCleaningAlLead) {
      if (!alUnits) return json({ error: "invalid_al_units" }, 400);
      if (!alServices.length || alServices.length !== alServiceCodes.length) return json({ error: "invalid_al_services" }, 400);
      if (!alTurnaround) return json({ error: "invalid_al_turnaround" }, 400);
      if (!alAccess) return json({ error: "invalid_al_access" }, 400);
    } else {
      if (!serviceType) return json({ error: "invalid_service_type" }, 400);
      if (!spaceType) return json({ error: "invalid_space_type" }, 400);
      if (!spaceSize) return json({ error: "invalid_space_size" }, 400);
      if (!serviceFrequency) return json({ error: "invalid_service_frequency" }, 400);
    }
    if (!preferredTimePeriods.length || preferredTimePeriods.length !== periodCodes.length || (periodCodes.includes("flexible") && periodCodes.length > 1)) {
      return json({ error: "invalid_preferred_time_period" }, 400);
    }
    if (!isCleaningAlLead && frequencyCode === "one_time" && !oneTimeTiming) return json({ error: "invalid_one_time_timing" }, 400);
    if (!isCleaningAlLead && frequencyCode === "one_time" && timingCode === "specific_date" && !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      return json({ error: "invalid_preferred_date" }, 400);
    }
    if (!isCleaningAlLead && ["weekly", "fortnightly", "monthly"].includes(frequencyCode) && (!preferredWeekdays.length || preferredWeekdays.length !== weekdayCodes.length || (weekdayCodes.includes("flexible") && weekdayCodes.length > 1))) {
      return json({ error: "invalid_preferred_weekday" }, 400);
    }
    if (cleanText(body.eventId, 128).length < 8) return json({ error: "invalid_event_id" }, 400);
  }

  const groups = {
    newsletter: env.SENDER_GROUP_MARKETING || DEFAULT_GROUPS.newsletter,
    guiaVenderCasa: env.SENDER_GROUP_GUIA_VENDER_CASA || DEFAULT_GROUPS.guiaVenderCasa,
    guiaParceiros: env.SENDER_GROUP_GUIA_PARCEIROS || DEFAULT_GROUPS.guiaParceiros
  };

  const postalLookup = isQualifiedLead ? await lookupPostalCode(postalCode) : null;
  if (postalLookup?.status === "not_found") {
    return json({ error: "postal_not_found" }, 400);
  }

  if (isCleaningLead) {
    const dashboardResult = await sendCleaningLead(env, body, postalCode, postalLookup?.municipality || "Por confirmar", consentText);
    if (!dashboardResult.ok) {
      return json({ error: "dashboard_error", code: dashboardResult.code }, dashboardResult.status === 503 ? 503 : 502);
    }
    if (!marketingConsent) {
      return json({
        ok: true,
        locality: postalLookup?.locality || "Por confirmar",
        dashboardStored: true,
        ...(postalLookup?.status === "unavailable" ? { locationPending: true } : {})
      }, 200);
    }
  }

  if (!env.SENDER_API_TOKEN) {
    return json({ error: "not_configured" }, 503);
  }

  const consentDate = new Date().toISOString();
  const fields = {
    "{$CONSENT_DATA}": consentDate,
    "{$CONSENT_IP}": cleanText(request.headers.get("CF-Connecting-IP"), 64),
    "{$CONSENT_VERSAO}": consentVersion,
    ...(!isDirectValueLead && !isCleaningLead || marketingConsent ? { "{$CONSENT_MARKETING}": marketingConsent ? "true" : "false" } : {}),
    ...(!isCleaningLead ? { "{$CONSENT_PARCEIROS}": partnerConsent ? "true" : "false" } : {}),
    "{$ORIGEM}": cleanText(body.pageUrl, 2048),
    "{$LEAD_SOURCE}": source,
    "{$EVENT_ID}": cleanText(body.eventId, 128),
    ...(isQualifiedLead && !isCleaningLead ? {
      "{$CODIGO_POSTAL}": postalCode,
      "{$LOCALIDADE}": postalLookup?.locality || "Por confirmar",
      "{$PRAZO_VENDA}": saleTimeline
    } : {}),
    ...(isCleaningAlLead && marketingConsent ? {
      "{$CODIGO_POSTAL}": postalCode,
      "{$LOCALIDADE}": postalLookup?.locality || "Por confirmar",
      "{$AL_UNIDADES}": alUnits,
      "{$AL_SERVICOS}": alServices.join(", "),
      "{$AL_JANELA}": alTurnaround,
      "{$AL_ACESSO}": alAccess,
      "{$PEDIDO_RESUMO}": [alUnits, alServices.join(", "), alTurnaround, alAccess].filter(Boolean).join(" · ")
    } : {})
  };

  try {
    const subscriberGroups = [
      ...(!isDirectValueLead && !isCleaningLead || marketingConsent ? [groups.newsletter] : []),
      ...(partnerConsent && !isCleaningLead ? [groups.guiaParceiros] : []),
      ...(source === "ebook-vender-casa" ? [groups.guiaVenderCasa] : [])
    ];
    const subscriberResult = await createOrUpdateSubscriber(
      env,
      email,
      fields,
      subscriberGroups,
      source === "ebook-vender-casa",
      isCleaningLead ? "" : phone,
      firstname
    );

    if (subscriberResult.created) {
      return json({
        ok: true,
        ...(isQualifiedLead ? { locality: postalLookup?.locality, locationStored: subscriberResult.locationStored } : {}),
        ...(isCleaningLead ? { dashboardStored: true } : {})
      }, 200);
    }

    if (!isDirectValueLead && !isCleaningLead || marketingConsent) {
      await addSubscriberToGroup(env, groups.newsletter, email, false);
    }

    if (partnerConsent && !isCleaningLead) {
      await addSubscriberToGroup(env, groups.guiaParceiros, email, false);
    }

    if (source === "ebook-vender-casa") {
      await addSubscriberToGroup(env, groups.guiaVenderCasa, email, true);
    }

    return json({
      ok: true,
      ...(isQualifiedLead ? { locality: postalLookup?.locality, locationStored: subscriberResult.locationStored } : {}),
      ...(isCleaningLead ? { dashboardStored: true } : {})
    }, 200);
  } catch (error) {
    const code = error instanceof SenderError ? error.code : "unknown";
    return json({ error: "provider_error", code }, 502);
  }
};

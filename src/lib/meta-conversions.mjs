export const OFFICIAL_META_DATASET_ID = "1394294186173855";
export const DEFAULT_META_GRAPH_VERSION = "v25.0";
export const META_MEASUREMENT_CONSENT_VERSION = "2026-09-01-1";

const encoder = new TextEncoder();

const clean = (value, maxLength = 500) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const cleanCookieId = (value) => {
  const normalized = clean(value, 240);
  return /^fb\.[12]\.\d{8,}\.[-A-Za-z0-9_.:]+$/u.test(normalized) ? normalized : "";
};

const sha256Hex = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sameSiteUrl = (value, fallback) => {
  try {
    const parsed = new URL(value || fallback);
    const expected = new URL(fallback);
    return parsed.origin === expected.origin ? parsed.toString().slice(0, 1000) : expected.origin;
  } catch {
    return fallback;
  }
};

export function hasMetaMeasurementConsent(request) {
  const cookie = request.headers.get("Cookie") || "";
  const raw = cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("gp_cookie_preferences="))
    ?.slice("gp_cookie_preferences=".length);
  if (!raw) return false;
  try {
    const preferences = JSON.parse(decodeURIComponent(raw));
    return preferences?.version === META_MEASUREMENT_CONSENT_VERSION && preferences?.measurement === true;
  } catch {
    return false;
  }
}

export function buildMetaAttribution(request, values = {}) {
  if (!hasMetaMeasurementConsent(request)) return null;
  const requestUrl = new URL(request.url);
  return {
    consent: true,
    fbp: cleanCookieId(values.fbp),
    fbc: cleanCookieId(values.fbc),
    eventSourceUrl: sameSiteUrl(request.headers.get("Referer"), requestUrl.origin),
    clientIpAddress: clean(request.headers.get("CF-Connecting-IP"), 80),
    clientUserAgent: clean(request.headers.get("User-Agent"), 500)
  };
}

export function parseMetaAttribution(value) {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return null; }
  }
  if (!parsed || typeof parsed !== "object" || parsed.consent !== true) return null;
  return {
    consent: true,
    fbp: cleanCookieId(parsed.fbp),
    fbc: cleanCookieId(parsed.fbc),
    eventSourceUrl: clean(parsed.eventSourceUrl, 1000),
    clientIpAddress: clean(parsed.clientIpAddress, 80),
    clientUserAgent: clean(parsed.clientUserAgent, 500)
  };
}

export async function sendMetaConversion({
  accessToken,
  datasetId = OFFICIAL_META_DATASET_ID,
  graphVersion = DEFAULT_META_GRAPH_VERSION,
  eventName,
  eventId,
  eventTime = Math.floor(Date.now() / 1000),
  eventSourceUrl,
  email,
  externalId,
  fbp,
  fbc,
  clientIpAddress,
  clientUserAgent,
  customData = {},
  fetchImpl = fetch,
  testEventCode = ""
}) {
  const token = clean(accessToken, 4096);
  const resolvedDatasetId = clean(datasetId, 40);
  const resolvedEventName = clean(eventName, 80);
  const resolvedEventId = clean(eventId, 160);
  if (!token || !/^\d{10,30}$/u.test(resolvedDatasetId)) return { sent: false, reason: "not_configured" };
  if (!resolvedEventName || !resolvedEventId) throw new Error("invalid_meta_event");

  const userData = {};
  const normalizedEmail = clean(email, 254).toLowerCase();
  const normalizedExternalId = clean(externalId, 200).toLowerCase();
  if (normalizedEmail) userData.em = [await sha256Hex(normalizedEmail)];
  if (normalizedExternalId) userData.external_id = [await sha256Hex(normalizedExternalId)];
  const validFbp = cleanCookieId(fbp);
  const validFbc = cleanCookieId(fbc);
  if (validFbp) userData.fbp = validFbp;
  if (validFbc) userData.fbc = validFbc;
  const ip = clean(clientIpAddress, 80);
  const userAgent = clean(clientUserAgent, 500);
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;

  const event = {
    event_name: resolvedEventName,
    event_time: Number.isFinite(Number(eventTime)) ? Math.floor(Number(eventTime)) : Math.floor(Date.now() / 1000),
    event_id: resolvedEventId,
    action_source: "website",
    event_source_url: clean(eventSourceUrl, 1000),
    user_data: userData,
    custom_data: customData
  };
  const payload = { data: [event], access_token: token };
  const code = clean(testEventCode, 80);
  if (code) payload.test_event_code = code;

  const response = await fetchImpl(
    `https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(resolvedDatasetId)}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    }
  );
  let result = {};
  try { result = await response.json(); } catch { /* a resposta HTTP decide o resultado */ }
  if (!response.ok || result?.error) {
    const codeValue = result?.error?.code || response.status || "unknown";
    throw new Error(`meta_conversion_failed_${codeValue}`);
  }
  return { sent: true, eventsReceived: Number(result?.events_received || 0) };
}

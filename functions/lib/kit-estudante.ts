const SENDER_API = "https://api.sender.net/v2";
const GROUP_TITLE = "Kit Estudante Deslocado";
const SESSION_COOKIE = "gp_kit_session";
const SESSION_TTL_SECONDS = 24 * 60 * 60;

export const CONSENT_VERSION = "kit-estudante-2026-v1";
export const DEFAULT_META_GRAPH_VERSION = "v25.0";
export const ALLOWED_SOURCES = new Set(["meta", "artigo", "grupo", "pdf", "direto"]);
export const ALLOWED_CITIES = new Set(["lisboa", "porto", "coimbra", "braga", "aveiro", "evora", "faro", "outra"]);
export const ALLOWED_PHASES = new Set(["procura", "encontrou", "tratado"]);

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface KitEnv {
  KIT_ESTUDANTE_DB?: D1Database;
  DB?: D1Database;
  SENDER_API_TOKEN?: string;
  SENDER_GROUP_KIT_ESTUDANTE?: string;
  SESSION_SECRET?: string;
  META_APP_SECRET?: string;
  META_PAGE_ACCESS_TOKEN?: string;
  META_VERIFY_TOKEN?: string;
  META_GRAPH_VERSION?: string;
  META_FORM_ADMIN_SECRET?: string;
  MAKE_META_LEADS_SECRET?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

export interface RequestContext {
  request: Request;
  env: KitEnv;
}

export class PublicError extends Error {
  constructor(readonly status: number, readonly publicCode: string) {
    super(publicCode);
  }
}

export class ProviderError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const encoder = new TextEncoder();

export const json = (body: object, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  }
});

export const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export const normalizeEmail = (value: unknown) => cleanText(value, 254).toLowerCase();

export const isValidEmail = (email: string) =>
  email.length >= 6 && email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

export const isQualifiedParentRelation = (value: unknown) => {
  const normalized = cleanText(value, 254)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized === "pai mae encarregado"
    || /^(sou )?pai mae ou encarregado de educacao( de um estudante do ensino superior)?$/.test(normalized);
};

export const requestId = (request: Request) =>
  cleanText(request.headers.get("CF-Ray"), 80) || crypto.randomUUID();

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptEmail(email: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(secret), encoder.encode(email));
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptEmail(payload: string, secret: string) {
  const [ivPart, dataPart] = payload.split(".");
  if (!ivPart || !dataPart) throw new ProviderError("invalid_session_payload");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(ivPart) },
    await encryptionKey(secret),
    base64UrlToBytes(dataPart)
  );
  return new TextDecoder().decode(decrypted);
}

export function requireConfiguration(env: KitEnv) {
  const db = env.KIT_ESTUDANTE_DB || env.DB;
  if (!db || !env.SENDER_API_TOKEN || !env.SESSION_SECRET) {
    throw new ProviderError("configuration_missing");
  }
  return {
    db,
    senderToken: env.SENDER_API_TOKEN,
    sessionSecret: env.SESSION_SECRET
  };
}

export async function readSmallJson(request: Request, maxBytes = 4096) {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    throw new PublicError(415, "invalid_content_type");
  }
  const declaredLength = Number(request.headers.get("Content-Length") || "0");
  if (declaredLength > maxBytes) throw new PublicError(413, "payload_too_large");
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > maxBytes) throw new PublicError(413, "payload_too_large");
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new PublicError(400, "invalid_payload");
  }
}

export function cookieValue(request: Request, name = SESSION_COOKIE) {
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function createSession(db: D1Database, leadId: number) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db.prepare(
    "INSERT INTO kit_sessions (token_hash, lead_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).bind(tokenHash, leadId, expiresAt, now.toISOString()).run();
  return { token, tokenHash, expiresAt };
}

export async function resolveSession(request: Request, db: D1Database, secret: string) {
  const token = cookieValue(request);
  if (!token || token.length > 128) throw new PublicError(401, "session_required");
  const tokenHash = await sha256(token);
  const session = await db.prepare(
    `SELECT s.lead_id AS leadId, s.expires_at AS expiresAt, l.email_cipher AS emailCipher
     FROM kit_sessions s JOIN kit_leads l ON l.id = s.lead_id
     WHERE s.token_hash = ? LIMIT 1`
  ).bind(tokenHash).first<{ leadId: number; expiresAt: string; emailCipher: string }>();
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    if (session) await db.prepare("DELETE FROM kit_sessions WHERE token_hash = ?").bind(tokenHash).run();
    throw new PublicError(401, "session_expired");
  }
  return { ...session, tokenHash, email: await decryptEmail(session.emailCipher, secret) };
}

export async function checkRateLimit(request: Request, db: D1Database, secret: string, limit: number) {
  const ip = cleanText(request.headers.get("CF-Connecting-IP"), 80) || "unknown";
  const ipHash = await sha256(`${secret}:${ip}`);
  const windowStart = new Date(Math.floor(Date.now() / 600_000) * 600_000).toISOString();
  await db.prepare(
    `INSERT INTO kit_rate_limits (ip_hash, window_start, hits) VALUES (?, ?, 1)
     ON CONFLICT(ip_hash) DO UPDATE SET
       hits = CASE WHEN window_start = excluded.window_start THEN hits + 1 ELSE 1 END,
       window_start = excluded.window_start`
  ).bind(ipHash, windowStart).run();
  const row = await db.prepare("SELECT hits FROM kit_rate_limits WHERE ip_hash = ?").bind(ipHash).first<{ hits: number }>();
  if ((row?.hits || 0) > limit) throw new PublicError(429, "too_many_requests");
  return ipHash;
}

interface EventInput {
  leadId?: number | null;
  source?: string;
  event: string;
  field?: string;
  value?: string;
  status: "received" | "success" | "error" | "ignored";
  error?: string;
  consentVersion?: string;
  sessionHash?: string;
  metaLeadId?: string;
  requestId?: string;
  ipHash?: string;
}

export async function logEvent(db: D1Database, input: EventInput) {
  await db.prepare(
    `INSERT INTO kit_events
      (occurred_at, lead_id, source, event, field_name, field_value, status, error_code,
       consent_version, session_hash, meta_lead_id, request_id, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    new Date().toISOString(), input.leadId || null, input.source || null, input.event,
    input.field || null, input.value || null, input.status, input.error || null,
    input.consentVersion || null, input.sessionHash || null, input.metaLeadId || null,
    input.requestId || null, input.ipHash || null
  ).run();
}

async function senderRequest(env: KitEnv, path: string, init: RequestInit = {}) {
  const response = await fetch(`${SENDER_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.SENDER_API_TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers
    },
    signal: AbortSignal.timeout(8000)
  });
  return response;
}

let discoveredGroupId = "";

function groupRows(payload: unknown): Array<{ id?: unknown; title?: unknown; name?: unknown }> {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data;
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data;
  }
  return [];
}

export async function getKitGroupId(env: KitEnv) {
  if (env.SENDER_GROUP_KIT_ESTUDANTE) return env.SENDER_GROUP_KIT_ESTUDANTE;
  if (discoveredGroupId) return discoveredGroupId;
  const response = await senderRequest(env, "/groups?limit=100", { method: "GET" });
  if (!response.ok) throw new ProviderError(`sender_groups_${response.status}`);
  const rows = groupRows(await response.json());
  const group = rows.find((row) => cleanText(row.title || row.name, 120) === GROUP_TITLE);
  const id = cleanText(group?.id, 64);
  if (!id) throw new ProviderError("sender_group_not_found");
  discoveredGroupId = id;
  return id;
}

function senderContactId(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
  return cleanText(data.id, 80);
}

type SenderFieldValue = string | number | boolean;

const KIT_SENDER_FIELD_TITLES = new Set([
  "est_origem",
  "est_cidade",
  "est_fase",
  "est_proprietario",
  "est_relacao"
]);

function senderData(payload: unknown) {
  if (!payload || typeof payload !== "object") return {} as Record<string, unknown>;
  const record = payload as Record<string, unknown>;
  return record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : record;
}

function senderFieldRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) {
    return record.data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) {
      return nested.data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
    }
    if (nested.field_name) return [nested];
  }
  return [];
}

async function senderExistingFields(env: KitEnv, subscriberPayload: unknown) {
  const columns = senderData(subscriberPayload).columns;
  if (!Array.isArray(columns)) return {} as Record<string, SenderFieldValue>;
  const existingFields: Record<string, SenderFieldValue> = {};
  const fallbackColumns: Array<Record<string, unknown>> = [];
  for (const column of columns) {
    if (!column || typeof column !== "object") continue;
    const record = column as Record<string, unknown>;
    const value = record.value;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") continue;
    if (typeof value === "string" && !value.trim()) continue;
    const title = cleanText(record.title, 128);
    if (KIT_SENDER_FIELD_TITLES.has(title)) {
      existingFields[`{$${title}}`] = value;
      continue;
    }
    fallbackColumns.push(record);
  }
  if (!fallbackColumns.length) return existingFields;

  const response = await senderRequest(env, "/fields?limit=100", { method: "GET" });
  if (!response.ok) throw new ProviderError(`sender_fields_${response.status}`);
  const namesById = new Map(senderFieldRows(await response.json()).map((field) => [
    cleanText(field.id, 80),
    cleanText(field.field_name, 128)
  ]));
  for (const record of fallbackColumns) {
    const fieldName = namesById.get(cleanText(record.id, 80)) || "";
    if (!fieldName.startsWith("{$") || !fieldName.endsWith("}")) continue;
    existingFields[fieldName] = record.value as SenderFieldValue;
  }
  return existingFields;
}

function senderGroupIds(payload: unknown) {
  if (!payload || typeof payload !== "object") return new Set<string>();
  const record = payload as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
  const groups = [data.groups, data.subscriber_tags, data.tags].find(Array.isArray) as Array<unknown> | undefined;
  return new Set((groups || []).map((entry) => {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object") return cleanText((entry as Record<string, unknown>).id, 80);
    return "";
  }).filter(Boolean));
}

export async function createOrUpdateKitSubscriber(
  env: KitEnv,
  email: string,
  fields: Record<string, SenderFieldValue>,
  triggerAutomation: boolean,
  additionalGroupIds: string[] = []
) {
  const identifier = encodeURIComponent(email);
  const existing = await senderRequest(env, `/subscribers/${identifier}`, { method: "GET" });
  if (existing.ok) {
    const existingPayload = await existing.json().catch(() => ({}));
    const groupId = await getKitGroupId(env);
    const mergedFields = { ...await senderExistingFields(env, existingPayload), ...fields };
    const updated = await senderRequest(env, `/subscribers/${identifier}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: mergedFields, trigger_automation: false })
    });
    if (!updated.ok) throw new ProviderError(`sender_update_${updated.status}`);
    return {
      created: false,
      contactId: senderContactId(existingPayload),
      inGroup: senderGroupIds(existingPayload).has(groupId)
    };
  }
  if (existing.status !== 404) throw new ProviderError(`sender_lookup_${existing.status}`);

  const groupId = await getKitGroupId(env);
  const requestedGroupIds = [...new Set([groupId, ...additionalGroupIds.map((id) => cleanText(id, 80)).filter(Boolean)])];
  const created = await senderRequest(env, "/subscribers", {
    method: "POST",
    body: JSON.stringify({ email, groups: requestedGroupIds, fields, trigger_automation: triggerAutomation })
  });
  if (created.ok) return { created: true, contactId: senderContactId(await created.json().catch(() => ({}))), inGroup: true };

  if (created.status === 409) {
    const conflicted = await senderRequest(env, `/subscribers/${identifier}`, { method: "GET" });
    if (!conflicted.ok) throw new ProviderError(`sender_conflict_lookup_${conflicted.status}`);
    const conflictedPayload = await conflicted.json().catch(() => ({}));
    const mergedFields = { ...await senderExistingFields(env, conflictedPayload), ...fields };
    const updated = await senderRequest(env, `/subscribers/${identifier}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: mergedFields, trigger_automation: false })
    });
    if (updated.ok) return {
      created: false,
      contactId: senderContactId(conflictedPayload),
      inGroup: senderGroupIds(conflictedPayload).has(groupId)
    };
  }
  throw new ProviderError(`sender_create_${created.status}`);
}

export async function addKitGroup(env: KitEnv, email: string, triggerAutomation: boolean) {
  const groupId = await getKitGroupId(env);
  const response = await senderRequest(env, `/subscribers/groups/${encodeURIComponent(groupId)}`, {
    method: "POST",
    body: JSON.stringify({ subscribers: [email], trigger_automation: triggerAutomation })
  });
  if (!response.ok) throw new ProviderError(`sender_group_${response.status}`);
}

export async function ensureKitGroupMembership(env: KitEnv, email: string, triggerAutomation: boolean) {
  const identifier = encodeURIComponent(email);
  const existing = await senderRequest(env, `/subscribers/${identifier}`, { method: "GET" });
  if (!existing.ok) throw new ProviderError(`sender_lookup_${existing.status}`);
  const existingPayload = await existing.json().catch(() => ({}));
  const groupId = await getKitGroupId(env);
  const existingGroupIds = senderGroupIds(existingPayload);
  if (existingGroupIds.has(groupId)) return false;
  const updated = await senderRequest(env, `/subscribers/${identifier}`, {
    method: "PATCH",
    body: JSON.stringify({ groups: [...existingGroupIds, groupId], trigger_automation: triggerAutomation })
  });
  if (!updated.ok) throw new ProviderError(`sender_group_update_${updated.status}`);
  return true;
}

export async function upsertLead(
  db: D1Database,
  email: string,
  secret: string,
  source: string,
  consentVersion: string,
  senderContactIdValue: string
) {
  const emailHash = await sha256(email);
  const encrypted = await encryptEmail(email, secret);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO kit_leads
      (email_hash, email_cipher, sender_contact_id, first_source, last_source, consent_version, consent_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email_hash) DO UPDATE SET
       email_cipher = excluded.email_cipher,
       sender_contact_id = CASE WHEN excluded.sender_contact_id <> '' THEN excluded.sender_contact_id ELSE sender_contact_id END,
       last_source = excluded.last_source,
       consent_version = excluded.consent_version,
       consent_at = excluded.consent_at,
       updated_at = excluded.updated_at`
  ).bind(emailHash, encrypted, senderContactIdValue, source, source, consentVersion, now, now, now).run();
  const row = await db.prepare("SELECT id FROM kit_leads WHERE email_hash = ?").bind(emailHash).first<{ id: number }>();
  if (!row) throw new ProviderError("lead_storage_failed");
  return row.id;
}

export async function cleanupExpiredSessions(db: D1Database) {
  await db.prepare("DELETE FROM kit_sessions WHERE expires_at <= ?").bind(new Date().toISOString()).run();
}

export function safeErrorResponse(error: unknown) {
  if (error instanceof PublicError) return json({ error: error.publicCode }, error.status);
  return json({ error: "service_unavailable" }, 503);
}

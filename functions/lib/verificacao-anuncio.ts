import {
  IntakeValidationError,
  MAX_UPLOAD_TOTAL_BYTES,
  validateAccessToken,
  validateCity,
  validateUploadFiles
} from "../../src/lib/verificacao-anuncio/intake.mjs";
import {
  OFFICIAL_META_DATASET_ID,
  buildMetaAttribution,
  parseMetaAttribution,
  sendMetaConversion
} from "../../src/lib/meta-conversions.mjs";
import { normalizeVerificationAttribution } from "../../src/lib/verificacao-anuncio/attribution.mjs";

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } & Record<string, unknown> }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface R2Bucket {
  get(key: string): Promise<{
    body: ReadableStream;
    arrayBuffer(): Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
  } | null>;
  put(key: string, value: ArrayBuffer | ArrayBufferView, options?: {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  }): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

export interface Queue<T = unknown> {
  send(message: T): Promise<void>;
}

export interface VerificationEnv {
  VERIFICACAO_ANUNCIO_DB?: D1Database;
  VERIFICACAO_ANUNCIO_UPLOADS?: R2Bucket;
  VERIFICACAO_ANUNCIO_QUEUE?: Queue;
  VERIFICACAO_ACCESS_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID?: string;
  SITE_URL?: string;
  SENDER_API_TOKEN?: string;
  SENDER_TRANSACTIONAL_FROM_EMAIL?: string;
  SENDER_TRANSACTIONAL_FROM_NAME?: string;
  VERIFICACAO_PUBLIC_INTAKE_ENABLED?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_DATASET_ID?: string;
  META_GRAPH_VERSION?: string;
  META_TEST_EVENT_CODE?: string;
}

export interface RequestContext {
  request: Request;
  env: VerificationEnv;
  waitUntil?(promise: Promise<unknown>): void;
}

export interface VerificationRow {
  id: string;
  estado: string;
  criadoEm: string;
  uploadEm: string | null;
  entregueEm: string | null;
  expiraEm: string;
  uploadExpiraEm: string | null;
  ficheirosJson: string | null;
  precheckEstado: string;
  precheckJson: string | null;
  pagamentoEstado: string;
  emailCipher: string;
  accessTokenCipher: string | null;
  stripeSessionId: string;
  metaAttributionCipher: string | null;
}

export class PublicVerificationError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

const encoder = new TextEncoder();

export const json = (body: object, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  }
});

const base64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
};

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return base64Url(new Uint8Array(digest));
}

const base64UrlToBytes = (value: string) => {
  const padded = value.replace(/-/gu, "+").replace(/_/gu, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptPrivateValue(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(secret), encoder.encode(value));
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

export async function decryptPrivateValue(payload: string, secret: string) {
  const [ivPart, dataPart] = payload.split(".");
  if (!ivPart || !dataPart) throw new PublicVerificationError(500, "invalid_private_value");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(ivPart) },
    await encryptionKey(secret),
    base64UrlToBytes(dataPart)
  );
  return new TextDecoder().decode(decrypted);
}

export async function createPrivateAccess(secret: string) {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  return {
    token,
    tokenHash: await sha256(token),
    tokenCipher: await encryptPrivateValue(token, secret)
  };
}

export function requireConfiguration(env: VerificationEnv, includeUpload = false) {
  if (!env.VERIFICACAO_ANUNCIO_DB || !env.VERIFICACAO_ACCESS_SECRET) {
    throw new PublicVerificationError(503, "service_not_configured");
  }
  if (includeUpload && (!env.VERIFICACAO_ANUNCIO_UPLOADS || !env.VERIFICACAO_ANUNCIO_QUEUE)) {
    throw new PublicVerificationError(503, "upload_not_configured");
  }
  return {
    db: env.VERIFICACAO_ANUNCIO_DB,
    uploads: env.VERIFICACAO_ANUNCIO_UPLOADS,
    queue: env.VERIFICACAO_ANUNCIO_QUEUE,
    secret: env.VERIFICACAO_ACCESS_SECRET
  };
}

export function ensureSameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new PublicVerificationError(403, "origin_not_allowed");
  }
}

export function readToken(request: Request) {
  try {
    return validateAccessToken(new URL(request.url).searchParams.get("t"));
  } catch (error) {
    if (error instanceof IntakeValidationError) throw new PublicVerificationError(error.status, error.code);
    throw error;
  }
}

export async function findVerification(db: D1Database, token: string) {
  const tokenHash = await sha256(token);
  const row = await db.prepare(
    `SELECT id, estado, criado_em AS criadoEm, upload_em AS uploadEm,
      entregue_em AS entregueEm, expira_em AS expiraEm, upload_expira_em AS uploadExpiraEm,
      ficheiros_json AS ficheirosJson, precheck_estado AS precheckEstado,
      precheck_json AS precheckJson, pagamento_estado AS pagamentoEstado,
      email_cipher AS emailCipher, access_token_cipher AS accessTokenCipher,
      stripe_session_id AS stripeSessionId, meta_attribution_cipher AS metaAttributionCipher
     FROM verificacao_anuncio_jobs WHERE access_token_hash = ? LIMIT 1`
  ).bind(tokenHash).first<VerificationRow>();
  if (!row) throw new PublicVerificationError(404, "verification_not_found");
  return { row, tokenHash };
}

export async function sendVerificationMetaConversion(
  env: VerificationEnv,
  row: { id: string; emailCipher: string; metaAttributionCipher?: string | null },
  options: {
    eventName: string;
    eventId: string;
    eventTime?: number;
    customData?: Record<string, unknown>;
    request?: Request;
  }
) {
  if (!env.META_CAPI_ACCESS_TOKEN || !row.metaAttributionCipher || !env.VERIFICACAO_ACCESS_SECRET) {
    return { sent: false, reason: "not_configured" };
  }
  const attribution = parseMetaAttribution(await decryptPrivateValue(row.metaAttributionCipher, env.VERIFICACAO_ACCESS_SECRET));
  if (!attribution) return { sent: false, reason: "no_consent" };
  const email = await decryptPrivateValue(row.emailCipher, env.VERIFICACAO_ACCESS_SECRET);
  const request = options.request;
  return sendMetaConversion({
    accessToken: env.META_CAPI_ACCESS_TOKEN,
    datasetId: env.META_DATASET_ID || OFFICIAL_META_DATASET_ID,
    graphVersion: env.META_GRAPH_VERSION,
    testEventCode: env.META_TEST_EVENT_CODE,
    eventName: options.eventName,
    eventId: options.eventId,
    eventTime: options.eventTime,
    eventSourceUrl: attribution.eventSourceUrl,
    email,
    externalId: row.id,
    fbp: attribution.fbp,
    fbc: attribution.fbc,
    clientIpAddress: request?.headers.get("CF-Connecting-IP") || attribution.clientIpAddress,
    clientUserAgent: request?.headers.get("User-Agent") || attribution.clientUserAgent,
    customData: options.customData || {}
  });
}

export async function checkRateLimit(request: Request, db: D1Database, secret: string, limit: number) {
  const ip = (request.headers.get("CF-Connecting-IP") || "unknown").trim().slice(0, 80);
  const ipHash = await sha256(`${secret}:${ip}`);
  const windowStart = new Date(Math.floor(Date.now() / 600_000) * 600_000).toISOString();
  await db.prepare(
    `INSERT INTO verificacao_anuncio_rate_limits (ip_hash, window_start, hits) VALUES (?, ?, 1)
     ON CONFLICT(ip_hash, window_start) DO UPDATE SET hits = hits + 1`
  ).bind(ipHash, windowStart).run();
  const row = await db.prepare(
    "SELECT hits FROM verificacao_anuncio_rate_limits WHERE ip_hash = ? AND window_start = ?"
  ).bind(ipHash, windowStart).first<{ hits: number }>();
  if ((row?.hits || 0) > limit) throw new PublicVerificationError(429, "too_many_requests");
}

export async function readUpload(request: Request, options: { requireEmail?: boolean } = {}) {
  const contentType = (request.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.startsWith("multipart/form-data")) {
    throw new PublicVerificationError(415, "multipart_form_required");
  }
  const declaredLength = Number(request.headers.get("Content-Length") || "0");
  if (declaredLength > MAX_UPLOAD_TOTAL_BYTES + 1024 * 1024) {
    throw new PublicVerificationError(413, "payload_too_large");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new PublicVerificationError(400, "invalid_multipart_form");
  }
  if (form.get("confirmacao_privacidade") !== "sim") {
    throw new PublicVerificationError(400, "privacy_confirmation_required");
  }
  let cidade: string;
  try {
    cidade = validateCity(form.get("cidade"));
  } catch (error) {
    if (error instanceof IntakeValidationError) throw new PublicVerificationError(error.status, error.code);
    throw error;
  }
  const captures = form.getAll("capturas").filter((value): value is File => value instanceof File);
  try {
    const email = String(form.get("email") || "").trim().toLowerCase();
    if (options.requireEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) {
      throw new PublicVerificationError(400, "invalid_email");
    }
    const metaAttribution = form.get("meta_consent") === "sim"
      ? buildMetaAttribution(request, { fbp: form.get("meta_fbp"), fbc: form.get("meta_fbc") })
      : null;
    const marketingAttribution = normalizeVerificationAttribution({
      source: form.get("utm_source"),
      medium: form.get("utm_medium"),
      campaign: form.get("utm_campaign"),
      content: form.get("utm_content")
    });
    return { cidade, email, captures: await validateUploadFiles(captures), metaAttribution, marketingAttribution };
  } catch (error) {
    if (error instanceof IntakeValidationError) throw new PublicVerificationError(error.status, error.code);
    throw error;
  }
}

export function safeError(error: unknown) {
  if (error instanceof PublicVerificationError) return json({ ok: false, error: error.code }, error.status);
  console.error("verification_request_failed", error instanceof Error ? error.name : "unknown");
  return json({ ok: false, error: "temporary_error" }, 500);
}

const encoder = new TextEncoder();
const bytes = (text) => encoder.encode(text);
const hex = (buffer) => [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
export const digest = async (text) => hex(await crypto.subtle.digest('SHA-256', bytes(text)));
const b64 = (array) => btoa(String.fromCharCode(...array));
const unb64 = (text) => Uint8Array.from(atob(text), x => x.charCodeAt(0));

export function archiveConfigured(env) {
  return Boolean(env.CONSENT_ARCHIVE_DB && typeof env.CONSENT_ARCHIVE_KEY === 'string' && env.CONSENT_ARCHIVE_KEY.length >= 32);
}
async function signingKey(secret) {
  return crypto.subtle.importKey('raw', bytes(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
}
async function indexFor(secret, value) {
  return hex(await crypto.subtle.sign('HMAC', await signingKey(secret), bytes(value)));
}
async function encryptionKey(secret) {
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', bytes('consent-encryption-v1:' + secret)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(env, record, id) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(id)}, await encryptionKey(env.CONSENT_ARCHIVE_KEY), bytes(JSON.stringify(record)));
  return b64(iv) + '.' + b64(new Uint8Array(cipher));
}
export async function openRecord(env, row) {
  const [iv, cipher] = row.payload.split('.');
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(iv), additionalData:bytes(row.id)}, await encryptionKey(env.CONSENT_ARCHIVE_KEY), unb64(cipher));
  const record = JSON.parse(new TextDecoder().decode(plain));
  const { integrity, ...original } = record;
  if (integrity !== await digest(JSON.stringify(original))) throw new Error('archive_integrity_failed');
  return record;
}

// Captured only at a first-party form endpoint. Never use a provider/webhook IP as the visitor IP.
export async function recordConsent(env, request, input) {
  if (!archiveConfigured(env)) throw new Error('consent_archive_not_configured');
  const email = input.email.trim().toLowerCase();
  const eventId = input.eventId || crypto.randomUUID();
  const emailKey = await indexFor(env.CONSENT_ARCHIVE_KEY, 'email:' + email);
  const id = await indexFor(env.CONSENT_ARCHIVE_KEY, 'event:' + JSON.stringify([email, input.source, eventId]));
  const declaration = {email, source:input.source, event_id:eventId, consent_version:input.version,
    choices:input.choices, consent_text:input.text, page_url:input.pageUrl || null};
  const fingerprint = await digest(JSON.stringify(declaration));
  const original = {schema_version:1, id, ...declaration, received_at:new Date().toISOString(),
    ip:request.headers.get('CF-Connecting-IP')?.slice(0,64) || null,
    ip_source:request.headers.has('CF-Connecting-IP') ? 'cloudflare_connecting_ip' : 'unavailable',
    user_agent:request.headers.get('User-Agent')?.slice(0,2048) || null,
    url_source:input.urlSource || 'form_declaration',
    collection_method:'first_party_form', fingerprint};
  const record = {...original, integrity:await digest(JSON.stringify(original))};
  const payload = await seal(env, record, id);
  const result = await env.CONSENT_ARCHIVE_DB.prepare(
    'INSERT INTO consent_evidence (id,email_key,received_at,payload) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING'
  ).bind(id,emailKey,record.received_at,payload).run();
  if (!result.success) throw new Error('consent_archive_write_failed');
  const row = await env.CONSENT_ARCHIVE_DB.prepare('SELECT id,payload FROM consent_evidence WHERE id = ?').bind(id).first();
  if (!row) throw new Error('consent_archive_read_failed');
  const saved = await openRecord(env,row);
  if(saved.fingerprint !== fingerprint) throw new Error('consent_event_conflict');
  return saved;
}
export async function findConsents(env, email, after = 0) {
  const key = await indexFor(env.CONSENT_ARCHIVE_KEY, 'email:' + email.trim().toLowerCase());
  const rows = await env.CONSENT_ARCHIVE_DB.prepare(
    'SELECT sequence,id,payload FROM consent_evidence WHERE email_key = ? AND sequence > ? ORDER BY sequence LIMIT 101'
  ).bind(key,after).all();
  const page = rows.results.slice(0,100);
  return {records:await Promise.all(page.map(row => openRecord(env,row))),
    next: rows.results.length > 100 ? page[page.length-1].sequence : null};
}

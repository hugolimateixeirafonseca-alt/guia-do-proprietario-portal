-- Pending PDF requests reference encrypted consent evidence, never plaintext contacts.
CREATE TABLE IF NOT EXISTS pdf_delivery_jobs (
 request_id TEXT PRIMARY KEY, evidence_id TEXT NOT NULL, email_hash TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','running','sent','review')),
 attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0,
 lease TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_code TEXT
);
CREATE INDEX IF NOT EXISTS pdf_delivery_due ON pdf_delivery_jobs(state,next_at,lease_until);

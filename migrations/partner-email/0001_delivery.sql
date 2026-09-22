CREATE TABLE IF NOT EXISTS email_delivery (
 event_id TEXT PRIMARY KEY,
 recipient_hash TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('processing','sending','sent','retry','uncertain','failed')),
 attempts INTEGER NOT NULL DEFAULT 1,
 lease_until INTEGER NOT NULL,
 next_attempt INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL,
 provider_status INTEGER,
 error_code TEXT
);

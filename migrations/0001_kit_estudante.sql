CREATE TABLE IF NOT EXISTS kit_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_hash TEXT NOT NULL UNIQUE,
  email_cipher TEXT NOT NULL,
  sender_contact_id TEXT,
  first_source TEXT NOT NULL,
  last_source TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kit_sessions (
  token_hash TEXT PRIMARY KEY,
  lead_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES kit_leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kit_sessions_lead ON kit_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_kit_sessions_expiry ON kit_sessions(expires_at);

CREATE TABLE IF NOT EXISTS kit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  lead_id INTEGER,
  source TEXT,
  event TEXT NOT NULL,
  field_name TEXT,
  field_value TEXT,
  status TEXT NOT NULL,
  error_code TEXT,
  consent_version TEXT,
  session_hash TEXT,
  meta_lead_id TEXT,
  request_id TEXT,
  ip_hash TEXT,
  FOREIGN KEY (lead_id) REFERENCES kit_leads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_kit_events_time ON kit_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_kit_events_lead ON kit_events(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kit_events_meta_lead
  ON kit_events(meta_lead_id, event)
  WHERE meta_lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS kit_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE consent_evidence (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  email_key TEXT NOT NULL,
  received_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX consent_evidence_email ON consent_evidence(email_key,sequence);
CREATE TRIGGER consent_evidence_no_update BEFORE UPDATE ON consent_evidence
BEGIN SELECT RAISE(ABORT, 'consent_evidence_is_append_only'); END;
-- No public update/delete route. Controlled erasure remains possible for retention and data-subject requests.

CREATE TABLE email_message_archive (
 event_id TEXT PRIMARY KEY REFERENCES email_delivery(event_id) ON DELETE CASCADE,
 content_ciphertext TEXT NOT NULL,
 captured_at INTEGER NOT NULL
);

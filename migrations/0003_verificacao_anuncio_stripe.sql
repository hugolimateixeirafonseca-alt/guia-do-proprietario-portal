ALTER TABLE verificacao_anuncio_jobs ADD COLUMN access_token_cipher TEXT;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN upload_expira_em TEXT;

CREATE TABLE IF NOT EXISTS verificacao_anuncio_stripe_events (
  event_id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('processing', 'completed', 'error')),
  job_id TEXT,
  erro TEXT,
  recebido_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  processado_em TEXT,
  FOREIGN KEY (job_id) REFERENCES verificacao_anuncio_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_verificacao_anuncio_stripe_estado_atualizado
  ON verificacao_anuncio_stripe_events(estado, atualizado_em);

PRAGMA optimize;


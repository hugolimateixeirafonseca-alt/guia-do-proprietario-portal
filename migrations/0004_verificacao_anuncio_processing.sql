ALTER TABLE verificacao_anuncio_jobs ADD COLUMN relatorio_pdf_key TEXT;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN processamento_bloqueado_em TEXT;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN falha_em TEXT;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN falha_motivo TEXT;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN custo_json TEXT;

CREATE TABLE IF NOT EXISTS verificacao_anuncio_notifications (
  job_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('processing', 'completed', 'error')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  enviado_em TEXT,
  PRIMARY KEY (job_id, tipo),
  FOREIGN KEY (job_id) REFERENCES verificacao_anuncio_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verificacao_anuncio_jobs_upload_expira
  ON verificacao_anuncio_jobs(estado, upload_expira_em);
CREATE INDEX IF NOT EXISTS idx_verificacao_anuncio_jobs_imagens_pendentes
  ON verificacao_anuncio_jobs(imagens_apagadas, imagens_apagar_em)
  WHERE imagens_apagadas = 0 AND imagens_apagar_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_verificacao_anuncio_notifications_estado
  ON verificacao_anuncio_notifications(estado, atualizado_em);

PRAGMA optimize;

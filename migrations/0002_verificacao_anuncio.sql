CREATE TABLE IF NOT EXISTS verificacao_anuncio_jobs (
  id TEXT PRIMARY KEY,
  access_token_hash TEXT NOT NULL UNIQUE,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_id TEXT UNIQUE,
  email_cipher TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN (
    'aguarda_upload', 'em_analise', 'entregue', 'expirado',
    'falhou_reembolsado', 'sem_upload_reembolsado'
  )),
  cidade TEXT,
  ficheiros_json TEXT,
  criado_em TEXT NOT NULL,
  upload_em TEXT,
  entregue_em TEXT,
  expira_em TEXT NOT NULL,
  imagens_apagar_em TEXT,
  imagens_apagadas INTEGER NOT NULL DEFAULT 0 CHECK (imagens_apagadas IN (0, 1)),
  resultado_json TEXT,
  pesquisa_visual_json TEXT,
  versao_motor TEXT,
  versao_pesquisa_visual TEXT,
  reembolsado_em TEXT,
  motivo_reembolso TEXT
);

CREATE TABLE IF NOT EXISTS verificacao_anuncio_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  estado TEXT NOT NULL,
  detalhe TEXT,
  criado_em TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES verificacao_anuncio_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verificacao_anuncio_rate_limits (
  ip_hash TEXT NOT NULL,
  window_start TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
);

CREATE INDEX IF NOT EXISTS idx_verificacao_anuncio_jobs_estado_criado
  ON verificacao_anuncio_jobs(estado, criado_em);
CREATE INDEX IF NOT EXISTS idx_verificacao_anuncio_jobs_imagens_apagar
  ON verificacao_anuncio_jobs(imagens_apagar_em)
  WHERE imagens_apagadas = 0 AND imagens_apagar_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_verificacao_anuncio_events_job_criado
  ON verificacao_anuncio_events(job_id, criado_em);

PRAGMA optimize;


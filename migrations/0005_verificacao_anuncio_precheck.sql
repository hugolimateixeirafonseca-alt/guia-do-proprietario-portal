ALTER TABLE verificacao_anuncio_jobs ADD COLUMN precheck_estado TEXT NOT NULL DEFAULT 'nao_aplicavel';
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN precheck_json TEXT;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN pagamento_estado TEXT NOT NULL DEFAULT 'pago';

CREATE INDEX IF NOT EXISTS idx_verificacao_anuncio_jobs_precheck
  ON verificacao_anuncio_jobs(precheck_estado, criado_em);
CREATE INDEX IF NOT EXISTS idx_verificacao_anuncio_jobs_pagamento
  ON verificacao_anuncio_jobs(pagamento_estado, criado_em);

PRAGMA optimize;

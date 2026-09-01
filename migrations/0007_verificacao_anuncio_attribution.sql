ALTER TABLE verificacao_anuncio_jobs ADD COLUMN source_channel TEXT NOT NULL DEFAULT 'direto';
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN utm_source TEXT;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN utm_medium TEXT;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN utm_campaign TEXT;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN utm_content TEXT;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN valor_pago_centimos INTEGER;
ALTER TABLE verificacao_anuncio_jobs ADD COLUMN moeda_pagamento TEXT;

UPDATE verificacao_anuncio_jobs
SET valor_pago_centimos = 390, moeda_pagamento = 'EUR'
WHERE pagamento_estado = 'pago'
  AND stripe_payment_id IS NOT NULL
  AND valor_pago_centimos IS NULL;

CREATE INDEX IF NOT EXISTS idx_verificacao_anuncio_jobs_source_criado
  ON verificacao_anuncio_jobs(source_channel, criado_em);

PRAGMA optimize;

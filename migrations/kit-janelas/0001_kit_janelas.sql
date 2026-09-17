-- Exclusivo do Kit Janelas. Não aplicar na base do Kit Estudante.
CREATE TABLE IF NOT EXISTS kit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  lead_id INTEGER,
  source TEXT NOT NULL CHECK(source = 'kit-trocar-janelas'),
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
  legacy_event_id INTEGER UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_janelas_events_request ON kit_events(request_id, event, status);
CREATE INDEX IF NOT EXISTS idx_janelas_events_time ON kit_events(occurred_at);
CREATE TABLE IF NOT EXISTS kit_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS kit_history_import (
  id INTEGER PRIMARY KEY CHECK(id=1),
  last_legacy_id INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO kit_history_import (id,last_legacy_id) VALUES (1,0);
CREATE VIEW IF NOT EXISTS inscricoes_meta AS
WITH pedidos AS (
  SELECT request_id, MIN(occurred_at) AS enviado_em_utc
  FROM kit_events WHERE event = 'janelas_pdf_sent' AND status = 'success'
  GROUP BY request_id
), ultimos_meta AS (
  SELECT request_id, status, error_code,
    ROW_NUMBER() OVER (PARTITION BY request_id ORDER BY occurred_at DESC, id DESC) AS posicao
  FROM kit_events WHERE event = 'janelas_meta_registration'
), aceites AS (
  SELECT DISTINCT request_id FROM kit_events
  WHERE event = 'janelas_meta_registration' AND status = 'success'
)
SELECT pedidos.request_id AS pedido_id, enviado_em_utc,
  date(enviado_em_utc, CASE WHEN
    enviado_em_utc >= date(substr(enviado_em_utc,1,4)||'-03-31','-6 days','weekday 0')||'T01:00:00.000Z'
    AND enviado_em_utc < date(substr(enviado_em_utc,1,4)||'-10-31','-6 days','weekday 0')||'T01:00:00.000Z'
    THEN '+1 hour' ELSE '+0 hours' END) AS dia_lisboa,
  CASE WHEN aceites.request_id IS NOT NULL THEN 'aceite'
    WHEN ultimos_meta.error_code = 'measurement_not_authorized' THEN 'sem_autorizacao'
    WHEN ultimos_meta.error_code = 'not_configured' THEN 'nao_configurado'
    WHEN ultimos_meta.status = 'error' THEN 'erro'
    WHEN ultimos_meta.request_id IS NULL THEN 'sem_registo'
    ELSE 'nao_aceite' END AS estado_meta,
  CASE WHEN aceites.request_id IS NOT NULL THEN 'Evento aceite pela API Meta; atribuição ao anúncio é independente'
    WHEN ultimos_meta.error_code = 'measurement_not_authorized' THEN 'Sem autorização válida de medição no pedido'
    WHEN ultimos_meta.error_code = 'not_configured' THEN 'Integração Meta não configurada'
    WHEN ultimos_meta.error_code = 'meta_timeout' THEN 'Tempo de resposta excedido após tentativas'
    WHEN ultimos_meta.error_code = 'meta_network' THEN 'Falha de ligação após tentativas'
    WHEN ultimos_meta.request_id IS NULL THEN 'Sem registo: pode estar pendente ou pertencer ao histórico sem motivo'
    ELSE COALESCE(ultimos_meta.error_code, 'Meta não confirmou aceitação') END AS motivo
FROM pedidos LEFT JOIN ultimos_meta ON ultimos_meta.request_id = pedidos.request_id AND posicao = 1
LEFT JOIN aceites ON aceites.request_id = pedidos.request_id;
CREATE VIEW IF NOT EXISTS inscricoes_nao_enviadas_meta AS
SELECT * FROM inscricoes_meta WHERE estado_meta <> 'aceite';
CREATE VIEW IF NOT EXISTS resumo_inscricoes_por_dia AS
SELECT dia_lisboa, COUNT(*) AS inscricoes,
  SUM(estado_meta = 'aceite') AS aceites_meta,
  SUM(estado_meta = 'sem_autorizacao') AS sem_autorizacao,
  SUM(estado_meta IN ('erro','nao_configurado','nao_aceite')) AS falhas_envio,
  SUM(estado_meta = 'sem_registo') AS sem_registo_meta
FROM inscricoes_meta GROUP BY dia_lisboa;

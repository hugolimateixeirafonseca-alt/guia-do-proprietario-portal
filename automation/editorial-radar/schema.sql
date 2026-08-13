PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS radar_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  candidates_found INTEGER NOT NULL DEFAULT 0,
  events_created INTEGER NOT NULL DEFAULT 0,
  duplicates_discarded INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  parent_event_id TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  pillar TEXT NOT NULL,
  event_date TEXT NOT NULL,
  legal_stage TEXT NOT NULL DEFAULT 'na',
  entities_json TEXT NOT NULL DEFAULT '[]',
  key_facts_json TEXT NOT NULL DEFAULT '[]',
  news_score INTEGER NOT NULL DEFAULT 0,
  seo_score INTEGER NOT NULL DEFAULT 0,
  lead_score INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  published_url TEXT,
  make_sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'candidate',
  FOREIGN KEY(parent_event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_pillar ON events(pillar, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_published ON events(published, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_parent ON events(parent_event_id);

CREATE TABLE IF NOT EXISTS event_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  article_url TEXT NOT NULL,
  published_at TEXT,
  source_type TEXT NOT NULL DEFAULT 'media',
  is_primary INTEGER NOT NULL DEFAULT 0,
  is_official INTEGER NOT NULL DEFAULT 0,
  UNIQUE(event_id, article_url),
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_sources_event ON event_sources(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_sources_url ON event_sources(article_url);

CREATE TABLE IF NOT EXISTS content_index (
  path TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  pillar TEXT,
  summary TEXT,
  body_excerpt TEXT,
  fingerprint TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_pillar ON content_index(pillar);
CREATE INDEX IF NOT EXISTS idx_content_title ON content_index(title);

CREATE TABLE IF NOT EXISTS content_impacts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  article_path TEXT NOT NULL,
  impact_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 0,
  old_claim TEXT,
  new_fact TEXT,
  recommendation TEXT NOT NULL,
  proposed_patch TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE(event_id, article_path),
  FOREIGN KEY(event_id) REFERENCES events(id),
  FOREIGN KEY(article_path) REFERENCES content_index(path)
);

CREATE INDEX IF NOT EXISTS idx_impacts_status ON content_impacts(status, severity);

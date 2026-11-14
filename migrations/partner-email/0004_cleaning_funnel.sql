CREATE TABLE IF NOT EXISTS cleaning_funnel_sessions (
 id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, last_seen INTEGER NOT NULL,
 source TEXT NOT NULL, device TEXT NOT NULL, region TEXT NOT NULL, entry TEXT NOT NULL,
 last_stage INTEGER NOT NULL CHECK(last_stage BETWEEN 1 AND 6)
);
CREATE INDEX IF NOT EXISTS cleaning_funnel_started ON cleaning_funnel_sessions(started_at);
CREATE INDEX IF NOT EXISTS cleaning_funnel_seen ON cleaning_funnel_sessions(last_seen);
CREATE TABLE IF NOT EXISTS cleaning_funnel_events (
 session_id TEXT NOT NULL, seq INTEGER NOT NULL CHECK(seq BETWEEN 0 AND 79),
 name TEXT NOT NULL, stage INTEGER NOT NULL CHECK(stage BETWEEN 1 AND 6),
 detail TEXT NOT NULL, elapsed INTEGER NOT NULL, at INTEGER NOT NULL,
 PRIMARY KEY(session_id, seq)
);
CREATE INDEX IF NOT EXISTS cleaning_funnel_event_session ON cleaning_funnel_events(session_id,name,stage);

CREATE TABLE IF NOT EXISTS provider_cooldown (
 provider TEXT PRIMARY KEY,
 blocked_until INTEGER NOT NULL
);

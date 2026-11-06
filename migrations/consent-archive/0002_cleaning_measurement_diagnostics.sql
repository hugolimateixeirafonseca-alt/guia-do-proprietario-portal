CREATE TABLE IF NOT EXISTS cleaning_measurement_diagnostics (
  event_key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('geral','alojamento-local')),
  measurement_choice TEXT NOT NULL CHECK(measurement_choice IN ('accepted','refused','unset','invalid')),
  browser_pixel_state TEXT NOT NULL CHECK(browser_pixel_state IN ('callable','missing','unknown'))
);
CREATE INDEX IF NOT EXISTS cleaning_measurement_created ON cleaning_measurement_diagnostics(created_at);
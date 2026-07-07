CREATE TABLE IF NOT EXISTS market_days (
  date TEXT PRIMARY KEY NOT NULL,
  cached_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_days_updated_at
  ON market_days (updated_at);

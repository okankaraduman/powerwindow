CREATE TABLE IF NOT EXISTS ree_daily_payloads (
  kind TEXT NOT NULL,
  date TEXT NOT NULL,
  cached_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (kind, date)
);

CREATE INDEX IF NOT EXISTS idx_ree_daily_payloads_updated_at
  ON ree_daily_payloads (kind, updated_at);

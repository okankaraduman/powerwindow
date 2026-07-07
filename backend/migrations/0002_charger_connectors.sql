CREATE TABLE IF NOT EXISTS connector_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_connector_accounts_user
  ON connector_accounts (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connector_accounts_provider_external
  ON connector_accounts (provider, external_account_id);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY NOT NULL,
  connector_account_id TEXT NOT NULL REFERENCES connector_accounts(id),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_device_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  max_kw REAL NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_user
  ON devices (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_provider_external
  ON devices (provider, external_device_id);

CREATE TABLE IF NOT EXISTS charge_plans (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id),
  date TEXT NOT NULL,
  start_hour INTEGER NOT NULL,
  duration_hours INTEGER NOT NULL,
  target_kwh REAL NOT NULL,
  charger_kw REAL NOT NULL,
  window_label TEXT NOT NULL,
  estimated_cost REAL NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_charge_plans_user_date
  ON charge_plans (user_id, date);

CREATE INDEX IF NOT EXISTS idx_charge_plans_device
  ON charge_plans (device_id);

CREATE TABLE IF NOT EXISTS charge_commands (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id),
  plan_id TEXT REFERENCES charge_plans(id),
  provider TEXT NOT NULL,
  command TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  request_json TEXT NOT NULL DEFAULT '{}',
  response_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_charge_commands_user
  ON charge_commands (user_id, requested_at);

CREATE INDEX IF NOT EXISTS idx_charge_commands_device
  ON charge_commands (device_id, requested_at);

-- Initial database schema for Graceful Books Sync Relay
-- Version: 1.0.0
-- Date: 2024-01-15
--
-- CRITICAL: This database stores ONLY encrypted payloads.
-- The server has ZERO KNOWLEDGE of the actual data.

-- Sync changes table
-- Stores encrypted change payloads from all devices
CREATE TABLE IF NOT EXISTS sync_changes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),
  encrypted_payload TEXT NOT NULL, -- Zero-knowledge: server cannot read this
  version_vector TEXT NOT NULL, -- JSON string
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_timestamp ON sync_changes(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_user_device ON sync_changes(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_entity ON sync_changes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON sync_changes(created_at);

-- SLA metrics table
-- Tracks request performance for monitoring
CREATE TABLE IF NOT EXISTS sla_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms REAL NOT NULL,
  region TEXT NOT NULL,
  success INTEGER NOT NULL CHECK(success IN (0, 1))
);

-- Indexes for metrics queries
CREATE INDEX IF NOT EXISTS idx_sla_timestamp ON sla_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_sla_endpoint ON sla_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_sla_region ON sla_metrics(region);

-- Health check history
-- Tracks server health over time
CREATE TABLE IF NOT EXISTS health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  region TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ok', 'degraded', 'error')),
  database_latency_ms REAL
);

-- Index for health check queries
CREATE INDEX IF NOT EXISTS idx_health_timestamp ON health_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_health_region ON health_checks(region);

-- FORGE-065/067: Dashboard tables — findings + experiments
-- Apply directly: psql $DATABASE_URL -f forge/drizzle/0003_forge_dashboard_tables.sql
-- (Not tracked in drizzle-kit journal — run after 0002_forge_api_keys.sql is applied)

CREATE TABLE IF NOT EXISTS "forge_findings" (
  "id"                    text PRIMARY KEY,
  "organization_id"       text NOT NULL,
  "site_id"               text NOT NULL,
  "rule_id"               text NOT NULL,
  "category"              text NOT NULL,
  "severity"              text NOT NULL,
  "confidence"            real NOT NULL,
  "priority_score"        real NOT NULL,
  "path_ref"              text,
  "title"                 text NOT NULL,
  "summary"               text NOT NULL,
  "recommendation"        jsonb NOT NULL,
  "evidence"              jsonb NOT NULL,
  "refs"                  jsonb,
  "status"                text NOT NULL DEFAULT 'open',
  "preview_url"           text,
  "preview_type"          text,
  "preview_notes"         text,
  "last_seen_at"          timestamptz NOT NULL,
  "insight_window_start"  timestamptz,
  "insight_window_end"    timestamptz,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "forge_findings_org_idx"          ON "forge_findings" ("organization_id");
CREATE INDEX IF NOT EXISTS "forge_findings_site_idx"         ON "forge_findings" ("site_id");
CREATE INDEX IF NOT EXISTS "forge_findings_site_status_idx"  ON "forge_findings" ("site_id", "status");
CREATE INDEX IF NOT EXISTS "forge_findings_site_priority_idx" ON "forge_findings" ("site_id", "priority_score");

CREATE TABLE IF NOT EXISTS "forge_experiments" (
  "id"                       text PRIMARY KEY,
  "organization_id"          text NOT NULL,
  "site_id"                  text NOT NULL,
  "finding_id"               text,
  "hypothesis"               text NOT NULL,
  "primary_metric"           text NOT NULL,
  "primary_metric_source"    text,
  "audience_control_pct"     integer NOT NULL DEFAULT 50,
  "audience_variant_pct"     integer NOT NULL DEFAULT 50,
  "duration_days"            integer NOT NULL DEFAULT 14,
  "status"                   text NOT NULL DEFAULT 'draft',
  "external_url"             text,
  "external_provider"        text,
  "external_id"              text,
  "guardrails"               jsonb,
  "notes"                    text,
  "result_control_rate"      real,
  "result_variant_rate"      real,
  "result_confidence"        real,
  "result_participants"      integer,
  "started_at"               timestamptz,
  "completed_at"             timestamptz,
  "created_at"               timestamptz NOT NULL DEFAULT now(),
  "updated_at"               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "forge_experiments_org_idx"        ON "forge_experiments" ("organization_id");
CREATE INDEX IF NOT EXISTS "forge_experiments_site_idx"       ON "forge_experiments" ("site_id");
CREATE INDEX IF NOT EXISTS "forge_experiments_finding_idx"    ON "forge_experiments" ("finding_id");
CREATE INDEX IF NOT EXISTS "forge_experiments_site_status_idx" ON "forge_experiments" ("site_id", "status");

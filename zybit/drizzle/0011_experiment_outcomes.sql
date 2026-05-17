-- FORGE-080: Outcome storage table
-- One row per concluded experiment. Written by compute-outcomes cron; never mutated.
-- Apply: psql $DATABASE_URL -f drizzle/0011_experiment_outcomes.sql

CREATE TABLE IF NOT EXISTS "zybit_experiment_outcomes" (
  "id"                    text PRIMARY KEY,
  "organization_id"       text NOT NULL,
  "site_id"               text NOT NULL,
  "experiment_id"         text NOT NULL,
  "finding_id"            text,
  "rule_id"               text,
  "path_ref"              text,
  "modification_type"     text,
  "result"                text NOT NULL,      -- 'positive' | 'negative' | 'inconclusive'
  "lift_pct"              real,               -- measured lift (negative = variant lost)
  "confidence"            real,               -- final statistical confidence 0..1
  "control_conversions"   integer,
  "control_participants"  integer,
  "variant_conversions"   integer,
  "variant_participants"  integer,
  "guardrail_breached"    text,               -- null or the event type that tripped
  "concluded_at"          timestamptz NOT NULL,
  "created_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "zybit_outcomes_experiment_idx" ON "zybit_experiment_outcomes" ("experiment_id");
CREATE INDEX IF NOT EXISTS "zybit_outcomes_site_idx"       ON "zybit_experiment_outcomes" ("site_id");
CREATE INDEX IF NOT EXISTS "zybit_outcomes_org_idx"        ON "zybit_experiment_outcomes" ("organization_id");

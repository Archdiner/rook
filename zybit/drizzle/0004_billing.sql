-- Migration: 0004_billing
-- Add billing columns to organizations + usage tracking table

ALTER TABLE "organizations" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN "stripe_subscription_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN "stripe_price_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN "plan_updated_at" TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS "zybit_usage" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "events_ingested" INTEGER NOT NULL DEFAULT 0,
  "snapshots_taken" INTEGER NOT NULL DEFAULT 0,
  "insights_runs" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "zybit_usage_org_period_idx"
  ON "zybit_usage" ("organization_id", "period");

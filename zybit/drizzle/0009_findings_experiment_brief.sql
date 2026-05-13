-- FORGE-PR4: Add experiment_brief column to forge_findings
ALTER TABLE "forge_findings"
  ADD COLUMN IF NOT EXISTS "experiment_brief" jsonb;

-- PR 3: Add prescription, impact_estimate, snapshot_diagram to forge_findings
-- These were in the AuditFinding TypeScript type but were not persisted to DB.

ALTER TABLE "forge_findings"
  ADD COLUMN IF NOT EXISTS "prescription"     jsonb,
  ADD COLUMN IF NOT EXISTS "impact_estimate"  jsonb,
  ADD COLUMN IF NOT EXISTS "snapshot_diagram" jsonb;

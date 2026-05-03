ALTER TABLE "forge_experiments" ADD COLUMN "modifications" JSONB;
ALTER TABLE "forge_experiments" ADD COLUMN "target_path" TEXT;
ALTER TABLE "phase1_sites" ADD COLUMN "proxy_slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "phase1_sites_proxy_slug_idx" ON "phase1_sites" ("proxy_slug");

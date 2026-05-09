-- Phase 1 (capture): headless page captures + per-capture blob assets + run tracking
-- phase2_page_captures: one row per (siteId, pathRef, breakpoint, cohort) per run
-- phase2_capture_assets: one row per blob (screenshot, HAR) per capture
-- phase2_capture_runs: one row per batch run for status tracking

CREATE TABLE "phase2_page_captures" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"site_id" text NOT NULL,
	"run_id" text,
	"path_ref" text NOT NULL,
	"final_url" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"breakpoint" text NOT NULL,
	"cohort" text NOT NULL DEFAULT 'logged_out',
	"content_hash" text NOT NULL,
	"capture_data" jsonb NOT NULL,
	"cost_usd" real NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase2_capture_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"site_id" text NOT NULL,
	"capture_id" text NOT NULL,
	"asset_type" text NOT NULL,
	"blob_url" text NOT NULL,
	"breakpoint" text,
	"byte_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase2_capture_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"site_id" text NOT NULL,
	"status" text NOT NULL DEFAULT 'pending',
	"total_paths" integer NOT NULL DEFAULT 0,
	"completed_paths" integer NOT NULL DEFAULT 0,
	"failed_paths" integer NOT NULL DEFAULT 0,
	"total_cost_usd" real NOT NULL DEFAULT 0,
	"error" text,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "phase2_page_captures_org_idx" ON "phase2_page_captures" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "phase2_page_captures_site_idx" ON "phase2_page_captures" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "phase2_page_captures_site_captured_idx" ON "phase2_page_captures" USING btree ("site_id","captured_at" DESC);--> statement-breakpoint
CREATE INDEX "phase2_page_captures_site_path_bp_idx" ON "phase2_page_captures" USING btree ("site_id","path_ref","breakpoint");--> statement-breakpoint
CREATE INDEX "phase2_page_captures_run_idx" ON "phase2_page_captures" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "phase2_capture_assets_capture_idx" ON "phase2_capture_assets" USING btree ("capture_id");--> statement-breakpoint
CREATE INDEX "phase2_capture_assets_site_idx" ON "phase2_capture_assets" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "phase2_capture_runs_site_idx" ON "phase2_capture_runs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "phase2_capture_runs_org_idx" ON "phase2_capture_runs" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "phase2_site_configs" ADD COLUMN "capture_budget_usd_day" real NOT NULL DEFAULT 1.0;--> statement-breakpoint
ALTER TABLE "forge_site_meta" ADD COLUMN "capture_spend_day_usd" real NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "forge_site_meta" ADD COLUMN "capture_spend_day_date" text;

CREATE TABLE "phase2_page_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"site_id" text NOT NULL,
	"path_ref" text NOT NULL,
	"url" text NOT NULL,
	"data" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "phase2_page_snapshots_org_idx" ON "phase2_page_snapshots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "phase2_page_snapshots_site_idx" ON "phase2_page_snapshots" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "phase2_page_snapshots_site_path_idx" ON "phase2_page_snapshots" USING btree ("site_id","path_ref");
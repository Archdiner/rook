CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase1_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"site_id" text NOT NULL,
	"session_id" text NOT NULL,
	"type" text NOT NULL,
	"path" text NOT NULL,
	"metrics" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"occurred_at" timestamp with time zone,
	"source" text,
	"source_event_id" text,
	"anonymous_id" text,
	"properties" jsonb,
	"schema_version" integer
);
--> statement-breakpoint
CREATE TABLE "phase1_readiness_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"site_id" text NOT NULL,
	"score" integer NOT NULL,
	"status" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"event_count" integer NOT NULL,
	"session_count" integer NOT NULL,
	"generated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase1_sites" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"analytics_provider" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase2_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"site_id" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret_ref" text,
	"cursor" jsonb,
	"last_synced_at" timestamp with time zone,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase2_site_configs" (
	"site_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"cohort_dimensions" jsonb NOT NULL,
	"onboarding_steps" jsonb NOT NULL,
	"ctas" jsonb NOT NULL,
	"narratives" jsonb NOT NULL,
	"conversion_event_types" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "phase1_events_org_idx" ON "phase1_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "phase1_events_site_idx" ON "phase1_events" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "phase1_events_occurred_at_idx" ON "phase1_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "phase1_events_site_occurred_idx" ON "phase1_events" USING btree ("site_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "phase1_events_dedupe_idx" ON "phase1_events" USING btree ("site_id","source","source_event_id");--> statement-breakpoint
CREATE INDEX "phase1_readiness_snapshots_org_idx" ON "phase1_readiness_snapshots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "phase1_readiness_snapshots_site_idx" ON "phase1_readiness_snapshots" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "phase1_sites_org_idx" ON "phase1_sites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "phase2_integrations_org_idx" ON "phase2_integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "phase2_integrations_site_idx" ON "phase2_integrations" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "phase2_integrations_site_provider_idx" ON "phase2_integrations" USING btree ("site_id","provider");--> statement-breakpoint
CREATE INDEX "phase2_site_configs_org_idx" ON "phase2_site_configs" USING btree ("organization_id");
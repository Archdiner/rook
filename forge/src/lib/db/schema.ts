import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const phase1Sites = pgTable(
  'phase1_sites',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    name: text('name').notNull(),
    domain: text('domain').notNull(),
    analyticsProvider: text('analytics_provider'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('phase1_sites_org_idx').on(table.organizationId),
  })
);

export const phase1Events = pgTable(
  'phase1_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    siteId: text('site_id').notNull(),
    sessionId: text('session_id').notNull(),
    type: text('type').notNull(),
    path: text('path').notNull(),
    metrics: jsonb('metrics').$type<Record<string, number> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Phase 2 canonical-event extensions (nullable for backward compatibility).
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    source: text('source'),
    sourceEventId: text('source_event_id'),
    anonymousId: text('anonymous_id'),
    properties: jsonb('properties').$type<Record<
      string,
      string | number | boolean | null
    > | null>(),
    schemaVersion: integer('schema_version'),
  },
  (table) => ({
    orgIdx: index('phase1_events_org_idx').on(table.organizationId),
    siteIdx: index('phase1_events_site_idx').on(table.siteId),
    occurredAtIdx: index('phase1_events_occurred_at_idx').on(table.occurredAt),
    siteOccurredIdx: index('phase1_events_site_occurred_idx').on(
      table.siteId,
      table.occurredAt
    ),
    dedupeIdx: uniqueIndex('phase1_events_dedupe_idx').on(
      table.siteId,
      table.source,
      table.sourceEventId
    ),
  })
);

export const phase2SiteConfigs = pgTable(
  'phase2_site_configs',
  {
    siteId: text('site_id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    cohortDimensions: jsonb('cohort_dimensions').$type<unknown>().notNull(),
    onboardingSteps: jsonb('onboarding_steps').$type<unknown>().notNull(),
    ctas: jsonb('ctas').$type<unknown>().notNull(),
    narratives: jsonb('narratives').$type<unknown>().notNull(),
    conversionEventTypes: jsonb('conversion_event_types').$type<string[] | null>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('phase2_site_configs_org_idx').on(table.organizationId),
  })
);

export const phase2Integrations = pgTable(
  'phase2_integrations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    siteId: text('site_id').notNull(),
    provider: text('provider').notNull(),
    status: text('status').notNull(),
    /** Provider-specific config (e.g. PostHog host + projectId). Never holds secrets. */
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    /** Env-var name where the secret API key lives (never the secret value itself). */
    secretRef: text('secret_ref'),
    cursor: jsonb('cursor').$type<Record<string, unknown> | null>(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('phase2_integrations_org_idx').on(table.organizationId),
    siteIdx: index('phase2_integrations_site_idx').on(table.siteId),
    siteProviderIdx: uniqueIndex('phase2_integrations_site_provider_idx').on(
      table.siteId,
      table.provider
    ),
  })
);

export const phase2PageSnapshots = pgTable(
  'phase2_page_snapshots',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    siteId: text('site_id').notNull(),
    /** Canonical path key (no query, no trailing slash) — `/`, `/pricing`, etc. */
    pathRef: text('path_ref').notNull(),
    /** Fully-qualified URL we fetched (final URL after redirects). */
    url: text('url').notNull(),
    /** Parsed snapshot payload (PageSnapshotData). */
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    /** sha256 hex of the normalized HTML — drift detector across re-fetches. */
    contentHash: text('content_hash').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('phase2_page_snapshots_org_idx').on(table.organizationId),
    siteIdx: index('phase2_page_snapshots_site_idx').on(table.siteId),
    sitePathIdx: uniqueIndex('phase2_page_snapshots_site_path_idx').on(
      table.siteId,
      table.pathRef
    ),
  })
);

export const forgeApiKeys = pgTable(
  'forge_api_keys',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    hashIdx: uniqueIndex('forge_api_keys_hash_idx').on(table.keyHash),
    orgIdx: index('forge_api_keys_org_idx').on(table.organizationId),
  })
);

export const phase1ReadinessSnapshots = pgTable(
  'phase1_readiness_snapshots',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    siteId: text('site_id').notNull(),
    score: integer('score').notNull(),
    status: text('status').notNull(),
    reasons: jsonb('reasons').$type<string[]>().notNull(),
    eventCount: integer('event_count').notNull(),
    sessionCount: integer('session_count').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    orgIdx: index('phase1_readiness_snapshots_org_idx').on(table.organizationId),
    siteIdx: index('phase1_readiness_snapshots_site_idx').on(table.siteId),
  })
);

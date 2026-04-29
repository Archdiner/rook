import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
  },
  (table) => ({
    orgIdx: index('phase1_events_org_idx').on(table.organizationId),
    siteIdx: index('phase1_events_site_idx').on(table.siteId),
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

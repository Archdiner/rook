import { and, desc, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import {
  phase1Events,
  phase1ReadinessSnapshots,
  phase1Sites,
  phase2SiteConfigs,
} from '@/lib/db/schema';
import type {
  CanonicalEvent,
  CanonicalEventSchemaVersion,
  CanonicalEventSource,
  Phase2SiteConfig,
} from '@/lib/phase2/types';

import type {
  CreateCanonicalEventInput,
  CreatePhase1EventInput,
  CreatePhase1ReadinessSnapshotInput,
  CreatePhase1SiteInput,
  GetLatestPhase1ReadinessSnapshotInput,
  GetPhase2SiteConfigInput,
  ListEventsInWindowInput,
  ListPhase1EventsInput,
  ListPhase1SitesInput,
  Phase1EventRecord,
  Phase1ReadinessSnapshotRecord,
  Phase1Repository,
  Phase1SiteRecord,
  UpsertPhase2SiteConfigInput,
} from './types';

type Phase1EventRow = typeof phase1Events.$inferSelect;
type Phase2SiteConfigRow = typeof phase2SiteConfigs.$inferSelect;

const LIST_WINDOW_LIMIT = 5000;

function mapEventRowToCanonicalEvent(row: Phase1EventRow): CanonicalEvent {
  // Legacy rows (pre Phase 2) lack occurredAt/source/schemaVersion; fall back without
  // mutating the canonical schema-version constant for newly written rows.
  const occurredAtIso = row.occurredAt
    ? row.occurredAt.toISOString()
    : row.createdAt.toISOString();
  const source: CanonicalEventSource = (row.source ?? 'api') as CanonicalEventSource;
  const schemaVersion = (row.schemaVersion ?? 1) as CanonicalEventSchemaVersion;

  const event: CanonicalEvent = {
    id: row.id,
    organizationId: row.organizationId,
    siteId: row.siteId,
    sessionId: row.sessionId,
    type: row.type,
    path: row.path,
    occurredAt: occurredAtIso,
    createdAt: row.createdAt.toISOString(),
    source,
    schemaVersion,
  };

  if (row.metrics) event.metrics = row.metrics as Record<string, number>;
  if (row.properties) {
    event.properties = row.properties as Record<string, string | number | boolean | null>;
  }
  if (row.anonymousId) event.anonymousId = row.anonymousId;
  if (row.sourceEventId) event.sourceEventId = row.sourceEventId;

  return event;
}

function mapRowToPhase2SiteConfig(row: Phase2SiteConfigRow): Phase2SiteConfig {
  const config: Phase2SiteConfig = {
    siteId: row.siteId,
    organizationId: row.organizationId,
    cohortDimensions: row.cohortDimensions as Phase2SiteConfig['cohortDimensions'],
    onboardingSteps: row.onboardingSteps as Phase2SiteConfig['onboardingSteps'],
    ctas: row.ctas as Phase2SiteConfig['ctas'],
    narratives: row.narratives as Phase2SiteConfig['narratives'],
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.conversionEventTypes && row.conversionEventTypes.length > 0) {
    config.conversionEventTypes = row.conversionEventTypes;
  }
  return config;
}

function toCanonicalInsertValues(input: CreateCanonicalEventInput) {
  return {
    id: input.id,
    organizationId: input.organizationId,
    siteId: input.siteId,
    sessionId: input.sessionId,
    type: input.type,
    path: input.path,
    metrics: input.metrics ?? null,
    properties: input.properties ?? null,
    anonymousId: input.anonymousId ?? null,
    source: input.source,
    sourceEventId: input.sourceEventId ?? null,
    schemaVersion: input.schemaVersion,
    occurredAt: new Date(input.occurredAt),
    createdAt: new Date(input.createdAt),
  };
}

export function createPostgresPhase1Repository(): Phase1Repository {
  return {
    driver: 'postgres',
    async createSite(input: CreatePhase1SiteInput): Promise<Phase1SiteRecord> {
      const db = getDb();
      const [created] = await db
        .insert(phase1Sites)
        .values({
          id: input.id,
          organizationId: input.organizationId,
          name: input.name,
          domain: input.domain,
          analyticsProvider: input.analyticsProvider ?? null,
          createdAt: new Date(input.createdAt),
        })
        .returning();

      return {
        id: created.id,
        organizationId: created.organizationId,
        name: created.name,
        domain: created.domain,
        createdAt: created.createdAt.toISOString(),
        ...(created.analyticsProvider ? { analyticsProvider: created.analyticsProvider } : {}),
      };
    },
    async listSites(input: ListPhase1SitesInput): Promise<Phase1SiteRecord[]> {
      const db = getDb();
      const rows = await db
        .select()
        .from(phase1Sites)
        .where(eq(phase1Sites.organizationId, input.organizationId))
        .orderBy(desc(phase1Sites.createdAt))
        .limit(input.limit ?? 50);

      return rows.map((site) => ({
        id: site.id,
        organizationId: site.organizationId,
        name: site.name,
        domain: site.domain,
        createdAt: site.createdAt.toISOString(),
        ...(site.analyticsProvider ? { analyticsProvider: site.analyticsProvider } : {}),
      }));
    },
    async createEvent(input: CreatePhase1EventInput): Promise<Phase1EventRecord> {
      const db = getDb();
      const [created] = await db
        .insert(phase1Events)
        .values({
          id: input.id,
          organizationId: input.organizationId,
          siteId: input.siteId,
          sessionId: input.sessionId,
          type: input.type,
          path: input.path,
          metrics: input.metrics ?? null,
          createdAt: new Date(input.createdAt),
        })
        .returning();

      return {
        id: created.id,
        organizationId: created.organizationId,
        siteId: created.siteId,
        sessionId: created.sessionId,
        type: created.type,
        path: created.path,
        createdAt: created.createdAt.toISOString(),
        ...(created.metrics ? { metrics: created.metrics as Record<string, number> } : {}),
      };
    },
    async listEvents(input: ListPhase1EventsInput): Promise<Phase1EventRecord[]> {
      const db = getDb();
      const rows = await db
        .select()
        .from(phase1Events)
        .where(
          and(
            eq(phase1Events.organizationId, input.organizationId),
            eq(phase1Events.siteId, input.siteId)
          )
        )
        .orderBy(desc(phase1Events.createdAt))
        .limit(input.limit ?? 100);

      return rows.map((event) => ({
        id: event.id,
        organizationId: event.organizationId,
        siteId: event.siteId,
        sessionId: event.sessionId,
        type: event.type,
        path: event.path,
        createdAt: event.createdAt.toISOString(),
        ...(event.metrics ? { metrics: event.metrics as Record<string, number> } : {}),
      }));
    },
    async createReadinessSnapshot(
      input: CreatePhase1ReadinessSnapshotInput
    ): Promise<Phase1ReadinessSnapshotRecord> {
      const db = getDb();
      const [created] = await db
        .insert(phase1ReadinessSnapshots)
        .values({
          id: input.id,
          organizationId: input.organizationId,
          siteId: input.siteId,
          score: input.score,
          status: input.status,
          reasons: input.reasons,
          eventCount: input.eventCount,
          sessionCount: input.sessionCount,
          generatedAt: new Date(input.generatedAt),
        })
        .returning();

      return {
        id: created.id,
        organizationId: created.organizationId,
        siteId: created.siteId,
        score: created.score,
        status: created.status as Phase1ReadinessSnapshotRecord['status'],
        reasons: created.reasons,
        eventCount: created.eventCount,
        sessionCount: created.sessionCount,
        generatedAt: created.generatedAt.toISOString(),
      };
    },
    async getLatestReadinessSnapshot(
      input: GetLatestPhase1ReadinessSnapshotInput
    ): Promise<Phase1ReadinessSnapshotRecord | null> {
      const db = getDb();
      const rows = await db
        .select()
        .from(phase1ReadinessSnapshots)
        .where(
          and(
            eq(phase1ReadinessSnapshots.organizationId, input.organizationId),
            eq(phase1ReadinessSnapshots.siteId, input.siteId)
          )
        )
        .orderBy(desc(phase1ReadinessSnapshots.generatedAt))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      return {
        id: row.id,
        organizationId: row.organizationId,
        siteId: row.siteId,
        score: row.score,
        status: row.status as Phase1ReadinessSnapshotRecord['status'],
        reasons: row.reasons,
        eventCount: row.eventCount,
        sessionCount: row.sessionCount,
        generatedAt: row.generatedAt.toISOString(),
      };
    },
    async createCanonicalEvent(input: CreateCanonicalEventInput): Promise<CanonicalEvent> {
      const db = getDb();
      const inserted = await db
        .insert(phase1Events)
        .values(toCanonicalInsertValues(input))
        .onConflictDoNothing({
          target: [phase1Events.siteId, phase1Events.source, phase1Events.sourceEventId],
        })
        .returning();

      if (inserted[0]) {
        return mapEventRowToCanonicalEvent(inserted[0]);
      }

      // Conflict on the dedupe key — fetch and return the existing row.
      if (input.sourceEventId) {
        const existing = await db
          .select()
          .from(phase1Events)
          .where(
            and(
              eq(phase1Events.siteId, input.siteId),
              eq(phase1Events.source, input.source),
              eq(phase1Events.sourceEventId, input.sourceEventId)
            )
          )
          .limit(1);
        if (existing[0]) return mapEventRowToCanonicalEvent(existing[0]);
      }

      throw new Error(
        'createCanonicalEvent: insert returned no rows and no dedupe key was provided.'
      );
    },
    async createCanonicalEventsBatch(
      inputs: CreateCanonicalEventInput[]
    ): Promise<{ inserted: number; deduped: number }> {
      if (inputs.length === 0) return { inserted: 0, deduped: 0 };
      const db = getDb();
      const insertedRows = await db
        .insert(phase1Events)
        .values(inputs.map(toCanonicalInsertValues))
        .onConflictDoNothing()
        .returning({ id: phase1Events.id });
      const inserted = insertedRows.length;
      return { inserted, deduped: inputs.length - inserted };
    },
    async listEventsInWindow(input: ListEventsInWindowInput): Promise<CanonicalEvent[]> {
      const db = getDb();
      const start = new Date(input.window.start);
      const end = new Date(input.window.end);
      const limit = Math.min(input.limit ?? LIST_WINDOW_LIMIT, LIST_WINDOW_LIMIT);

      const rows = await db
        .select()
        .from(phase1Events)
        .where(
          and(
            eq(phase1Events.organizationId, input.organizationId),
            eq(phase1Events.siteId, input.siteId),
            or(
              and(
                gte(phase1Events.occurredAt, start),
                lt(phase1Events.occurredAt, end)
              ),
              and(
                isNull(phase1Events.occurredAt),
                gte(phase1Events.createdAt, start),
                lt(phase1Events.createdAt, end)
              )
            )
          )
        )
        .orderBy(
          sql`coalesce(${phase1Events.occurredAt}, ${phase1Events.createdAt}) DESC`
        )
        .limit(limit);

      return rows.map(mapEventRowToCanonicalEvent);
    },
    async upsertPhase2SiteConfig(
      input: UpsertPhase2SiteConfigInput
    ): Promise<Phase2SiteConfig> {
      const db = getDb();
      const updatedAt = new Date(input.updatedAt);
      const conversionEventTypes = input.conversionEventTypes ?? null;
      const [row] = await db
        .insert(phase2SiteConfigs)
        .values({
          siteId: input.siteId,
          organizationId: input.organizationId,
          cohortDimensions: input.cohortDimensions,
          onboardingSteps: input.onboardingSteps,
          ctas: input.ctas,
          narratives: input.narratives,
          conversionEventTypes,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: phase2SiteConfigs.siteId,
          set: {
            organizationId: input.organizationId,
            cohortDimensions: input.cohortDimensions,
            onboardingSteps: input.onboardingSteps,
            ctas: input.ctas,
            narratives: input.narratives,
            conversionEventTypes,
            updatedAt,
          },
        })
        .returning();

      return mapRowToPhase2SiteConfig(row);
    },
    async getPhase2SiteConfig(
      input: GetPhase2SiteConfigInput
    ): Promise<Phase2SiteConfig | null> {
      const db = getDb();
      const rows = await db
        .select()
        .from(phase2SiteConfigs)
        .where(
          and(
            eq(phase2SiteConfigs.organizationId, input.organizationId),
            eq(phase2SiteConfigs.siteId, input.siteId)
          )
        )
        .limit(1);

      const row = rows[0];
      if (!row) return null;
      return mapRowToPhase2SiteConfig(row);
    },
  };
}

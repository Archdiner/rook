import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { phase1Events, phase1Sites } from '@/lib/db/schema';

import type {
  CreatePhase1EventInput,
  CreatePhase1ReadinessSnapshotInput,
  CreatePhase1SiteInput,
  GetLatestPhase1ReadinessSnapshotInput,
  ListPhase1EventsInput,
  ListPhase1SitesInput,
  Phase1EventRecord,
  Phase1ReadinessSnapshotRecord,
  Phase1Repository,
  Phase1SiteRecord,
} from './types';

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
      // TODO(phase1): Persist snapshots in Postgres once read models are wired.
      return {
        id: input.id,
        organizationId: input.organizationId,
        siteId: input.siteId,
        score: input.score,
        status: input.status,
        reasons: input.reasons,
        eventCount: input.eventCount,
        sessionCount: input.sessionCount,
        generatedAt: input.generatedAt,
      };
    },
    async getLatestReadinessSnapshot(
      input: GetLatestPhase1ReadinessSnapshotInput
    ): Promise<Phase1ReadinessSnapshotRecord | null> {
      void input;
      // TODO(phase1): Read snapshots from Postgres after snapshot persistence is implemented.
      return null;
    },
  };
}

import { appendJsonlRecord, readJsonlRecords } from '@/lib/phase1/storage';

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

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? 'org_default';
const DEFAULT_SITES_LIMIT = 50;
const DEFAULT_EVENTS_LIMIT = 100;

function isOrgMatch(recordOrgId: string | undefined, requestedOrgId: string): boolean {
  // Older blob/local records do not include organizationId; treat them as default org.
  const normalizedOrgId = recordOrgId ?? DEFAULT_ORG_ID;
  return normalizedOrgId === requestedOrgId;
}

export function createBlobPhase1Repository(): Phase1Repository {
  return {
    driver: 'blob',
    async createSite(input: CreatePhase1SiteInput): Promise<Phase1SiteRecord> {
      const site: Phase1SiteRecord = {
        id: input.id,
        organizationId: input.organizationId,
        name: input.name,
        domain: input.domain,
        createdAt: input.createdAt,
        ...(input.analyticsProvider ? { analyticsProvider: input.analyticsProvider } : {}),
      };

      await appendJsonlRecord('sites', site);
      return site;
    },
    async listSites(input: ListPhase1SitesInput): Promise<Phase1SiteRecord[]> {
      const sites = await readJsonlRecords<Phase1SiteRecord & { organizationId?: string }>('sites', {
        limit: input.limit ?? DEFAULT_SITES_LIMIT,
        monthsToScan: 6,
        filter: (record) => isOrgMatch(record.organizationId, input.organizationId),
      });

      return sites.map((site) => ({
        ...site,
        organizationId: site.organizationId ?? DEFAULT_ORG_ID,
      }));
    },
    async createEvent(input: CreatePhase1EventInput): Promise<Phase1EventRecord> {
      const event: Phase1EventRecord = {
        id: input.id,
        organizationId: input.organizationId,
        siteId: input.siteId,
        sessionId: input.sessionId,
        type: input.type,
        path: input.path,
        createdAt: input.createdAt,
        ...(input.metrics ? { metrics: input.metrics } : {}),
      };

      await appendJsonlRecord('events', event);
      return event;
    },
    async listEvents(input: ListPhase1EventsInput): Promise<Phase1EventRecord[]> {
      const events = await readJsonlRecords<Phase1EventRecord & { organizationId?: string }>('events', {
        limit: input.limit ?? DEFAULT_EVENTS_LIMIT,
        monthsToScan: 6,
        siteId: input.siteId,
        filter: (record) =>
          record.siteId === input.siteId && isOrgMatch(record.organizationId, input.organizationId),
      });

      return events.map((event) => ({
        ...event,
        organizationId: event.organizationId ?? DEFAULT_ORG_ID,
      }));
    },
    async createReadinessSnapshot(
      input: CreatePhase1ReadinessSnapshotInput
    ): Promise<Phase1ReadinessSnapshotRecord> {
      const snapshot: Phase1ReadinessSnapshotRecord = {
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

      await appendJsonlRecord('snapshots', snapshot);
      return snapshot;
    },
    async getLatestReadinessSnapshot(
      input: GetLatestPhase1ReadinessSnapshotInput
    ): Promise<Phase1ReadinessSnapshotRecord | null> {
      const snapshots = await readJsonlRecords<Phase1ReadinessSnapshotRecord & { organizationId?: string }>(
        'snapshots',
        {
          limit: 1,
          monthsToScan: 6,
          siteId: input.siteId,
          filter: (record) =>
            record.siteId === input.siteId && isOrgMatch(record.organizationId, input.organizationId),
        }
      );

      if (snapshots.length === 0) {
        return null;
      }

      const snapshot = snapshots[0];
      return {
        ...snapshot,
        organizationId: snapshot.organizationId ?? DEFAULT_ORG_ID,
      };
    },
  };
}

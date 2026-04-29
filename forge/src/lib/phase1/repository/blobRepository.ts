import { appendJsonlRecord, readJsonlRecords } from '@/lib/phase1/storage';
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

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? 'org_default';
const DEFAULT_SITES_LIMIT = 50;
const DEFAULT_EVENTS_LIMIT = 100;
const WINDOW_EVENTS_LIMIT = 5000;
const DEDUPE_SCAN_LIMIT = 5000;

type StoredCanonicalEvent = CanonicalEvent & {
  organizationId?: string;
};

type StoredPhase2SiteConfig = Phase2SiteConfig & {
  id: string;
  organizationId?: string;
};

function toCanonicalEvent(record: StoredCanonicalEvent): CanonicalEvent {
  // Legacy Phase 1 events lack canonical fields; coerce with safe defaults.
  const occurredAt = record.occurredAt ?? record.createdAt;
  const source: CanonicalEventSource = (record.source ?? 'api') as CanonicalEventSource;
  const schemaVersion = (record.schemaVersion ?? 1) as CanonicalEventSchemaVersion;

  const event: CanonicalEvent = {
    id: record.id,
    organizationId: record.organizationId ?? DEFAULT_ORG_ID,
    siteId: record.siteId,
    sessionId: record.sessionId,
    type: record.type,
    path: record.path,
    occurredAt,
    createdAt: record.createdAt,
    source,
    schemaVersion,
  };

  if (record.metrics) event.metrics = record.metrics;
  if (record.properties) event.properties = record.properties;
  if (record.anonymousId) event.anonymousId = record.anonymousId;
  if (record.sourceEventId) event.sourceEventId = record.sourceEventId;
  return event;
}

function buildEventRecord(input: CreateCanonicalEventInput): CanonicalEvent {
  const event: CanonicalEvent = {
    id: input.id,
    organizationId: input.organizationId,
    siteId: input.siteId,
    sessionId: input.sessionId,
    type: input.type,
    path: input.path,
    occurredAt: input.occurredAt,
    createdAt: input.createdAt,
    source: input.source,
    schemaVersion: input.schemaVersion as CanonicalEventSchemaVersion,
  };
  if (input.metrics) event.metrics = input.metrics;
  if (input.properties) event.properties = input.properties;
  if (input.anonymousId) event.anonymousId = input.anonymousId;
  if (input.sourceEventId) event.sourceEventId = input.sourceEventId;
  return event;
}

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
    /**
     * Append a canonical event to the shared `events` collection so legacy
     * `listEvents` callers continue to work. Dedupe is a linear scan over the
     * site's events; high-volume ingestion should use the Postgres driver.
     */
    async createCanonicalEvent(input: CreateCanonicalEventInput): Promise<CanonicalEvent> {
      if (input.sourceEventId) {
        const matches = await readJsonlRecords<StoredCanonicalEvent>('events', {
          siteId: input.siteId,
          monthsToScan: 6,
          limit: 1,
          filter: (record) =>
            record.siteId === input.siteId &&
            isOrgMatch(record.organizationId, input.organizationId) &&
            record.source === input.source &&
            record.sourceEventId === input.sourceEventId,
        });
        if (matches.length > 0) {
          return toCanonicalEvent(matches[0]);
        }
      }

      const event = buildEventRecord(input);
      await appendJsonlRecord('events', event);
      return event;
    },
    async createCanonicalEventsBatch(
      inputs: CreateCanonicalEventInput[]
    ): Promise<{ inserted: number; deduped: number }> {
      let inserted = 0;
      let deduped = 0;
      for (const input of inputs) {
        if (input.sourceEventId) {
          const matches = await readJsonlRecords<StoredCanonicalEvent>('events', {
            siteId: input.siteId,
            monthsToScan: 6,
            limit: 1,
            filter: (record) =>
              record.siteId === input.siteId &&
              isOrgMatch(record.organizationId, input.organizationId) &&
              record.source === input.source &&
              record.sourceEventId === input.sourceEventId,
          });
          if (matches.length > 0) {
            deduped += 1;
            continue;
          }
        }

        await appendJsonlRecord('events', buildEventRecord(input));
        inserted += 1;
      }
      return { inserted, deduped };
    },
    async listEventsInWindow(input: ListEventsInWindowInput): Promise<CanonicalEvent[]> {
      const start = Date.parse(input.window.start);
      const end = Date.parse(input.window.end);
      const limit = Math.min(input.limit ?? WINDOW_EVENTS_LIMIT, WINDOW_EVENTS_LIMIT);

      const records = await readJsonlRecords<StoredCanonicalEvent>('events', {
        siteId: input.siteId,
        monthsToScan: 6,
        limit: DEDUPE_SCAN_LIMIT,
        filter: (record) => {
          if (record.siteId !== input.siteId) return false;
          if (!isOrgMatch(record.organizationId, input.organizationId)) return false;
          const tsRaw = record.occurredAt ?? record.createdAt;
          const ts = Date.parse(tsRaw);
          if (Number.isNaN(ts)) return false;
          return ts >= start && ts < end;
        },
      });

      const events = records.map(toCanonicalEvent);
      events.sort((a, b) => {
        const ta = Date.parse(a.occurredAt ?? a.createdAt);
        const tb = Date.parse(b.occurredAt ?? b.createdAt);
        return tb - ta;
      });
      return events.slice(0, limit);
    },
    async upsertPhase2SiteConfig(
      input: UpsertPhase2SiteConfigInput
    ): Promise<Phase2SiteConfig> {
      // Synthesize a unique blob id so concurrent writes don't collide on the
      // partition path (`siteConfigs/{month}/{siteId}/{id}.json`). `getPhase2SiteConfig`
      // sorts by `updatedAt` desc on read, so the newest write always wins.
      const writeStamp = Date.now();
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const recordId = `${writeStamp}-${randomSuffix}`;
      const record: StoredPhase2SiteConfig = {
        id: recordId,
        siteId: input.siteId,
        organizationId: input.organizationId,
        cohortDimensions: input.cohortDimensions,
        onboardingSteps: input.onboardingSteps,
        ctas: input.ctas,
        narratives: input.narratives,
        updatedAt: input.updatedAt,
        ...(input.conversionEventTypes
          ? { conversionEventTypes: input.conversionEventTypes }
          : {}),
      };

      await appendJsonlRecord('siteConfigs', record);

      const result: Phase2SiteConfig = {
        siteId: input.siteId,
        organizationId: input.organizationId,
        cohortDimensions: input.cohortDimensions,
        onboardingSteps: input.onboardingSteps,
        ctas: input.ctas,
        narratives: input.narratives,
        updatedAt: input.updatedAt,
      };
      if (input.conversionEventTypes) {
        result.conversionEventTypes = input.conversionEventTypes;
      }
      return result;
    },
    async getPhase2SiteConfig(
      input: GetPhase2SiteConfigInput
    ): Promise<Phase2SiteConfig | null> {
      const records = await readJsonlRecords<StoredPhase2SiteConfig>('siteConfigs', {
        siteId: input.siteId,
        monthsToScan: 6,
        limit: 1,
        filter: (record) =>
          record.siteId === input.siteId &&
          isOrgMatch(record.organizationId, input.organizationId),
      });
      if (records.length === 0) return null;
      const record = records[0];
      const config: Phase2SiteConfig = {
        siteId: record.siteId,
        organizationId: record.organizationId ?? DEFAULT_ORG_ID,
        cohortDimensions: record.cohortDimensions,
        onboardingSteps: record.onboardingSteps,
        ctas: record.ctas,
        narratives: record.narratives,
        updatedAt: record.updatedAt,
      };
      if (record.conversionEventTypes && record.conversionEventTypes.length > 0) {
        config.conversionEventTypes = record.conversionEventTypes;
      }
      return config;
    },
  };
}

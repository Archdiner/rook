import { randomUUID } from 'node:crypto';

import { appendJsonlRecord, readJsonlRecords } from '@/lib/phase1/storage';
import type {
  CreateIntegrationInput,
  IntegrationRecord,
  IntegrationStatus,
  UpdateIntegrationStateInput,
} from '@/lib/phase2/connectors/types';
import type {
  GetPageSnapshotInput,
  ListPageSnapshotsInput,
  PageSnapshot,
  PageSnapshotData,
  UpsertPageSnapshotInput,
} from '@/lib/phase2/snapshots/types';
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
  GetIntegrationInput,
  GetLatestPhase1ReadinessSnapshotInput,
  GetPhase2SiteConfigInput,
  ListEventsInWindowInput,
  ListIntegrationsInput,
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
const DEFAULT_INTEGRATIONS_LIMIT = 100;
const WINDOW_EVENTS_LIMIT = 5000;
const DEDUPE_SCAN_LIMIT = 5000;

const DEFAULT_PAGE_SNAPSHOTS_LIMIT = 100;
const MAX_PAGE_SNAPSHOTS_LIMIT = 500;
/** Months scanned when listing/reading page snapshots from blob storage. */
const PAGE_SNAPSHOTS_MONTHS_TO_SCAN = 12;
/** Per-pathRef recent-history cap when reading a single snapshot. */
const PAGE_SNAPSHOTS_GET_LIMIT = 200;
/**
 * Multiplier applied to the caller's `limit` when listing snapshots. Records
 * are append-only, so we may need to scan past older entries to find the
 * latest write per pathRef.
 */
const PAGE_SNAPSHOTS_LIST_OVERSCAN = 5;

type StoredCanonicalEvent = CanonicalEvent & {
  organizationId?: string;
};

type StoredPhase2SiteConfig = Phase2SiteConfig & {
  id: string;
  organizationId?: string;
};

/**
 * Persisted shape for an integration record in the blob store.
 *
 * The blob layer uses `id` as the unique path component for `appendJsonlRecord`
 * (`phase1/integrations/{month}/{id}.json`); `integrationId` carries the stable
 * logical id surfaced to callers as `IntegrationRecord.id`. Each write
 * synthesizes a fresh `id` so concurrent writes for the same logical
 * integration never collide on the blob path.
 *
 * `(siteId, provider)` uniqueness is best-effort on this driver: two concurrent
 * `createIntegration` calls for the same `(siteId, provider)` may both win and
 * surface as two distinct logical ids in `listIntegrations`. Single-writer
 * ingestion or the Postgres driver should be used when strict uniqueness is
 * required.
 */
type StoredIntegrationRecord = Omit<IntegrationRecord, 'id'> & {
  id: string;
  integrationId: string;
};

/**
 * Persisted shape for a page snapshot in the blob store. Append-only; the
 * latest write per `(siteId, pathRef)` wins on read (blob layer sorts by
 * `fetchedAt` desc within the partition).
 */
type StoredPageSnapshot = {
  id: string;
  organizationId: string;
  siteId: string;
  pathRef: string;
  url: string;
  data: PageSnapshotData;
  contentHash: string;
  fetchedAt: string;
  createdAt: string;
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

function makeIntegrationBlobId(): string {
  // Per-write unique id keeps `appendJsonlRecord` from clashing on the blob
  // path (`allowOverwrite: false`). `readJsonlRecords` sorts entries by path
  // desc, so the lexicographically larger writeStamp lands first on read.
  const writeStamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `${writeStamp}-${randomSuffix}`;
}

function toPageSnapshot(record: StoredPageSnapshot): PageSnapshot {
  return {
    id: record.id,
    organizationId: record.organizationId,
    siteId: record.siteId,
    pathRef: record.pathRef,
    url: record.url,
    data: record.data,
    fetchedAt: new Date(record.fetchedAt),
    createdAt: new Date(record.createdAt),
  };
}

function toIntegrationRecord(record: StoredIntegrationRecord): IntegrationRecord {
  return {
    id: record.integrationId,
    organizationId: record.organizationId ?? DEFAULT_ORG_ID,
    siteId: record.siteId,
    provider: record.provider,
    status: record.status,
    config: record.config ?? {},
    secretRef: record.secretRef ?? null,
    cursor: record.cursor ?? null,
    lastSyncedAt: record.lastSyncedAt ?? null,
    lastErrorCode: record.lastErrorCode ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
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
    /**
     * Append-only PUT-style upsert. When a prior record exists for
     * `(organizationId, siteId, provider)` we reuse its logical `integrationId`
     * and `createdAt` and refresh `config` / `secretRef` / `updatedAt`; sync
     * state (`status`, `cursor`, `lastSyncedAt`, `lastErrorCode`) is preserved.
     * Brand-new records start at `status: 'pending'`.
     *
     * `(siteId, provider)` uniqueness is best-effort under concurrent writes —
     * see {@link StoredIntegrationRecord}. The Postgres driver is the strict
     * source of truth.
     */
    async createIntegration(input: CreateIntegrationInput): Promise<IntegrationRecord> {
      const matches = await readJsonlRecords<StoredIntegrationRecord>('integrations', {
        monthsToScan: 6,
        limit: 1,
        filter: (record) =>
          isOrgMatch(record.organizationId, input.organizationId) &&
          record.siteId === input.siteId &&
          record.provider === input.provider,
      });
      const existing = matches[0];

      const integrationId = existing ? existing.integrationId : input.id;
      const createdAt = existing ? existing.createdAt : input.createdAt;
      const status: IntegrationStatus = existing ? existing.status : 'pending';

      const stored: StoredIntegrationRecord = {
        id: makeIntegrationBlobId(),
        integrationId,
        organizationId: input.organizationId,
        siteId: input.siteId,
        provider: input.provider,
        status,
        config: input.config,
        secretRef: input.secretRef ?? null,
        cursor: existing ? existing.cursor : null,
        lastSyncedAt: existing ? existing.lastSyncedAt : null,
        lastErrorCode: existing ? existing.lastErrorCode : null,
        createdAt,
        updatedAt: input.createdAt,
      };

      await appendJsonlRecord('integrations', stored);
      return toIntegrationRecord(stored);
    },
    async updateIntegrationState(
      input: UpdateIntegrationStateInput
    ): Promise<IntegrationRecord> {
      const matches = await readJsonlRecords<StoredIntegrationRecord>('integrations', {
        monthsToScan: 6,
        limit: 1,
        filter: (record) =>
          record.integrationId === input.id &&
          isOrgMatch(record.organizationId, input.organizationId),
      });
      const latest = matches[0];
      if (!latest) throw new Error('Integration not found');

      const merged: StoredIntegrationRecord = {
        ...latest,
        id: makeIntegrationBlobId(),
        integrationId: latest.integrationId,
        organizationId: input.organizationId,
        updatedAt: input.updatedAt,
      };
      if (input.status !== undefined) merged.status = input.status;
      if (input.cursor !== undefined) merged.cursor = input.cursor;
      if (input.lastSyncedAt !== undefined) merged.lastSyncedAt = input.lastSyncedAt;
      if (input.lastErrorCode !== undefined) merged.lastErrorCode = input.lastErrorCode;

      await appendJsonlRecord('integrations', merged);
      return toIntegrationRecord(merged);
    },
    async getIntegration(
      input: GetIntegrationInput
    ): Promise<IntegrationRecord | null> {
      const matches = await readJsonlRecords<StoredIntegrationRecord>('integrations', {
        monthsToScan: 6,
        limit: 1,
        filter: (record) =>
          record.integrationId === input.id &&
          isOrgMatch(record.organizationId, input.organizationId),
      });
      const latest = matches[0];
      if (!latest) return null;
      return toIntegrationRecord(latest);
    },
    async listIntegrations(
      input: ListIntegrationsInput
    ): Promise<IntegrationRecord[]> {
      const records = await readJsonlRecords<StoredIntegrationRecord>('integrations', {
        monthsToScan: 6,
        limit: DEDUPE_SCAN_LIMIT,
        filter: (record) => {
          if (!isOrgMatch(record.organizationId, input.organizationId)) return false;
          if (input.siteId && record.siteId !== input.siteId) return false;
          if (input.provider && record.provider !== input.provider) return false;
          return true;
        },
      });

      // Records arrive newest-first (sorted by blob path desc, which encodes
      // writeStamp). Take the first hit per logical integrationId.
      const seen = new Set<string>();
      const latest: StoredIntegrationRecord[] = [];
      for (const record of records) {
        if (seen.has(record.integrationId)) continue;
        seen.add(record.integrationId);
        latest.push(record);
      }

      latest.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
      );

      const limit = Math.max(input.limit ?? DEFAULT_INTEGRATIONS_LIMIT, 1);
      return latest.slice(0, limit).map(toIntegrationRecord);
    },
    /**
     * Append a new page snapshot record. The blob driver is append-only, so
     * "upsert" semantics here mean: every fetch lands as its own blob, and
     * `getPageSnapshot` / `listPageSnapshots` reduce to the latest write per
     * `(siteId, pathRef)` (sorted by `fetchedAt` desc on read).
     */
    async upsertPageSnapshot(input: UpsertPageSnapshotInput): Promise<PageSnapshot> {
      const id = `phase2_page_snapshot_${randomUUID()}`;
      const now = new Date();
      const stored: StoredPageSnapshot = {
        id,
        organizationId: input.organizationId,
        siteId: input.siteId,
        pathRef: input.pathRef,
        url: input.url,
        data: input.data,
        contentHash: input.data.contentHash,
        fetchedAt: input.fetchedAt.toISOString(),
        createdAt: now.toISOString(),
      };

      await appendJsonlRecord('pageSnapshots', stored);

      return {
        id,
        organizationId: input.organizationId,
        siteId: input.siteId,
        pathRef: input.pathRef,
        url: input.url,
        data: input.data,
        fetchedAt: input.fetchedAt,
        createdAt: now,
      };
    },
    async getPageSnapshot(
      input: GetPageSnapshotInput
    ): Promise<PageSnapshot | null> {
      const records = await readJsonlRecords<StoredPageSnapshot>('pageSnapshots', {
        siteId: input.siteId,
        monthsToScan: PAGE_SNAPSHOTS_MONTHS_TO_SCAN,
        limit: PAGE_SNAPSHOTS_GET_LIMIT,
        filter: (record) =>
          record.organizationId === input.organizationId &&
          record.pathRef === input.pathRef,
      });

      const latest = records[0];
      if (!latest) return null;
      return toPageSnapshot(latest);
    },
    async listPageSnapshots(
      input: ListPageSnapshotsInput
    ): Promise<PageSnapshot[]> {
      const cap = Math.min(
        Math.max(input.limit ?? DEFAULT_PAGE_SNAPSHOTS_LIMIT, 1),
        MAX_PAGE_SNAPSHOTS_LIMIT
      );

      const records = await readJsonlRecords<StoredPageSnapshot>('pageSnapshots', {
        siteId: input.siteId,
        monthsToScan: PAGE_SNAPSHOTS_MONTHS_TO_SCAN,
        limit: cap * PAGE_SNAPSHOTS_LIST_OVERSCAN,
        filter: (record) => record.organizationId === input.organizationId,
      });

      // Records arrive sorted by `fetchedAt` desc; take the first hit per pathRef.
      const seen = new Set<string>();
      const out: PageSnapshot[] = [];
      for (const record of records) {
        if (seen.has(record.pathRef)) continue;
        seen.add(record.pathRef);
        out.push(toPageSnapshot(record));
        if (out.length >= cap) break;
      }
      return out;
    },
  };
}

import type {
  CanonicalEvent,
  CanonicalEventSource,
  Phase2SiteConfig,
  TimeWindow,
} from '@/lib/phase2/types';

export type Phase1RepositoryDriver = 'blob' | 'postgres';

export type Phase1StorageDriverSetting = 'auto' | Phase1RepositoryDriver;

export interface Phase1SiteRecord {
  id: string;
  organizationId: string;
  name: string;
  domain: string;
  analyticsProvider?: string;
  createdAt: string;
}

export interface CreatePhase1SiteInput {
  id: string;
  organizationId: string;
  name: string;
  domain: string;
  analyticsProvider?: string;
  createdAt: string;
}

export interface Phase1EventRecord {
  id: string;
  organizationId: string;
  siteId: string;
  sessionId: string;
  type: string;
  path: string;
  metrics?: Record<string, number>;
  createdAt: string;
}

export interface CreatePhase1EventInput {
  id: string;
  organizationId: string;
  siteId: string;
  sessionId: string;
  type: string;
  path: string;
  metrics?: Record<string, number>;
  createdAt: string;
}

export type Phase1ReadinessStatus = 'insufficient' | 'collecting' | 'sufficient';

export interface Phase1ReadinessSnapshotRecord {
  id: string;
  organizationId: string;
  siteId: string;
  score: number;
  status: Phase1ReadinessStatus;
  reasons: string[];
  eventCount: number;
  sessionCount: number;
  generatedAt: string;
}

export type CreatePhase1ReadinessSnapshotInput = Phase1ReadinessSnapshotRecord;

export interface ListPhase1SitesInput {
  organizationId: string;
  limit?: number;
}

export interface ListPhase1EventsInput {
  organizationId: string;
  siteId: string;
  limit?: number;
}

export interface GetLatestPhase1ReadinessSnapshotInput {
  organizationId: string;
  siteId: string;
}

export interface CreateCanonicalEventInput {
  id: string;
  organizationId: string;
  siteId: string;
  sessionId: string;
  type: string;
  path: string;
  occurredAt: string;
  createdAt: string;
  source: CanonicalEventSource;
  schemaVersion: number;
  metrics?: Record<string, number>;
  properties?: Record<string, string | number | boolean | null>;
  anonymousId?: string;
  sourceEventId?: string;
}

export interface ListEventsInWindowInput {
  organizationId: string;
  siteId: string;
  window: TimeWindow;
  limit?: number;
}

export type UpsertPhase2SiteConfigInput = Phase2SiteConfig;

export interface GetPhase2SiteConfigInput {
  organizationId: string;
  siteId: string;
}

export interface Phase1Repository {
  driver: Phase1RepositoryDriver;
  createSite(input: CreatePhase1SiteInput): Promise<Phase1SiteRecord>;
  listSites(input: ListPhase1SitesInput): Promise<Phase1SiteRecord[]>;
  createEvent(input: CreatePhase1EventInput): Promise<Phase1EventRecord>;
  listEvents(input: ListPhase1EventsInput): Promise<Phase1EventRecord[]>;
  createReadinessSnapshot(
    input: CreatePhase1ReadinessSnapshotInput
  ): Promise<Phase1ReadinessSnapshotRecord>;
  getLatestReadinessSnapshot(
    input: GetLatestPhase1ReadinessSnapshotInput
  ): Promise<Phase1ReadinessSnapshotRecord | null>;
  /** Phase 2: insert a single canonical event with `(siteId, source, sourceEventId)` dedupe. */
  createCanonicalEvent(input: CreateCanonicalEventInput): Promise<CanonicalEvent>;
  /** Phase 2: insert many canonical events in one round-trip; conflicting rows are deduped. */
  createCanonicalEventsBatch(
    inputs: CreateCanonicalEventInput[]
  ): Promise<{ inserted: number; deduped: number }>;
  /** Phase 2: read events for a site in a `[start, end)` window, ordered by `occurredAt` desc. */
  listEventsInWindow(input: ListEventsInWindowInput): Promise<CanonicalEvent[]>;
  /** Phase 2: insert or update a per-site config keyed on `siteId`. */
  upsertPhase2SiteConfig(input: UpsertPhase2SiteConfigInput): Promise<Phase2SiteConfig>;
  /** Phase 2: fetch the latest per-site config for `(organizationId, siteId)`. */
  getPhase2SiteConfig(input: GetPhase2SiteConfigInput): Promise<Phase2SiteConfig | null>;
}

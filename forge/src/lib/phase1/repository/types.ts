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
}

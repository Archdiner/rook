import { BlobNotFoundError, head, list, put } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type Phase1Collection = 'sites' | 'events' | 'snapshots';

export interface Phase1Site {
  id: string;
  name: string;
  domain: string;
  analyticsProvider?: string;
  createdAt: string;
}

export interface Phase1Event {
  id: string;
  siteId: string;
  sessionId: string;
  type: string;
  path: string;
  metrics?: Record<string, number>;
  createdAt: string;
}

export interface Phase1ReadinessSnapshot {
  id: string;
  siteId: string;
  score: number;
  status: 'insufficient' | 'collecting' | 'sufficient';
  reasons: string[];
  eventCount: number;
  sessionCount: number;
  generatedAt: string;
}

export class MissingBlobTokenError extends Error {
  code = 'BLOB_TOKEN_MISSING' as const;

  constructor(message = 'BLOB_READ_WRITE_TOKEN is not configured.') {
    super(message);
    this.name = 'MissingBlobTokenError';
  }
}

export class Phase1StorageError extends Error {
  code: 'BLOB_APPEND_FAILED' | 'BLOB_READ_FAILED';
  cause?: unknown;

  constructor(code: 'BLOB_APPEND_FAILED' | 'BLOB_READ_FAILED', message: string, cause?: unknown) {
    super(message);
    this.name = 'Phase1StorageError';
    this.code = code;
    this.cause = cause;
  }
}

interface BlobLikeEntry {
  pathname?: string;
}

const PHASE1_PREFIX = 'phase1';
const DEFAULT_READ_LIMIT = 100;
const DEFAULT_MONTHS_TO_SCAN = 6;
const LOCAL_FALLBACK_ROOT = path.join(os.tmpdir(), 'forge-phase1');
function getBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function getMonthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

function recentMonthKeys(count: number): string[] {
  const keys: string[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

/** Legacy monthly NDJSON blob (read-only compat). */
function legacyMonthJsonlPath(collection: Phase1Collection, month: string): string {
  return `${PHASE1_PREFIX}/${collection}/${month}.jsonl`;
}

function recordBlobPathname(
  collection: Phase1Collection,
  record: Record<string, unknown>,
  month: string
): string {
  const id = typeof record.id === 'string' ? record.id : null;
  if (!id) {
    throw new Phase1StorageError(
      'BLOB_APPEND_FAILED',
      `Record missing string id for ${collection} append.`
    );
  }

  switch (collection) {
    case 'sites':
      return `${PHASE1_PREFIX}/sites/${month}/${id}.json`;
    case 'events': {
      const siteId = typeof record.siteId === 'string' ? record.siteId : null;
      if (!siteId) {
        throw new Phase1StorageError(
          'BLOB_APPEND_FAILED',
          'Event record missing siteId for partitioned blob path.'
        );
      }
      return `${PHASE1_PREFIX}/events/${month}/${siteId}/${id}.json`;
    }
    case 'snapshots': {
      const siteId = typeof record.siteId === 'string' ? record.siteId : null;
      if (!siteId) {
        throw new Phase1StorageError(
          'BLOB_APPEND_FAILED',
          'Snapshot record missing siteId for partitioned blob path.'
        );
      }
      return `${PHASE1_PREFIX}/snapshots/${month}/${siteId}/${id}.json`;
    }
  }
}

function getLocalFallbackPath(pathname: string): string {
  return path.join(LOCAL_FALLBACK_ROOT, pathname);
}

async function writeLocalJsonRecord(pathname: string, record: object): Promise<void> {
  const filePath = getLocalFallbackPath(pathname);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(record), 'utf8');
}

async function listBlobJsonPathnames(prefix: string, token: string): Promise<string[]> {
  try {
    const result = await list({
      token,
      prefix,
      limit: 2000,
    });
    return (result.blobs as BlobLikeEntry[])
      .map((entry) => entry.pathname)
      .filter((pathname): pathname is string => Boolean(pathname?.endsWith('.json')));
  } catch (error) {
    throw new Phase1StorageError('BLOB_READ_FAILED', `Unable to list blobs for prefix ${prefix}`, error);
  }
}

function parseJsonObject<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseJsonlLine<T>(line: string): T | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return parseJsonObject(trimmed);
}

async function fetchBlobJson<T>(pathname: string, token: string): Promise<T | null> {
  try {
    const meta = await head(pathname, { token });
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) return null;
    return parseJsonObject<T>(await res.text());
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }
    throw new Phase1StorageError('BLOB_READ_FAILED', `Unable to read blob ${pathname}`, error);
  }
}

async function readLegacyMonthJsonl<T>(
  collection: Phase1Collection,
  month: string,
  token: string,
  filter: ((record: T) => boolean) | undefined,
  take: number
): Promise<T[]> {
  const pathname = legacyMonthJsonlPath(collection, month);
  const out: T[] = [];
  try {
    const meta = await head(pathname, { token });
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) return [];
    const lines = (await res.text()).split('\n').reverse();
    for (const line of lines) {
      if (out.length >= take) break;
      const parsed = parseJsonlLine<T>(line);
      if (!parsed) continue;
      if (filter && !filter(parsed)) continue;
      out.push(parsed);
    }
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return [];
    }
    throw error;
  }
  return out;
}

async function readLocalJsonFiles<T>(
  relativeDir: string,
  filter: ((record: T) => boolean) | undefined,
  limit: number
): Promise<T[]> {
  const dirPath = getLocalFallbackPath(relativeDir);
  let names: string[] = [];
  try {
    names = await fs.readdir(dirPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Phase1StorageError('BLOB_READ_FAILED', `Unable to read local dir ${relativeDir}`, error);
  }

  const jsonFiles = names.filter((n) => n.endsWith('.json')).sort((a, b) => b.localeCompare(a));
  const out: T[] = [];
  for (const name of jsonFiles) {
    if (out.length >= limit) break;
    try {
      const raw = await fs.readFile(path.join(dirPath, name), 'utf8');
      const parsed = parseJsonObject<T>(raw.trim());
      if (!parsed) continue;
      if (filter && !filter(parsed)) continue;
      out.push(parsed);
    } catch {
      continue;
    }
  }
  return out;
}

async function readLocalLegacyJsonlMonth<T>(
  collection: Phase1Collection,
  month: string,
  filter: ((record: T) => boolean) | undefined,
  limit: number
): Promise<T[]> {
  const pathname = legacyMonthJsonlPath(collection, month);
  const filePath = getLocalFallbackPath(pathname);
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Phase1StorageError('BLOB_READ_FAILED', `Unable to read local legacy ${pathname}`, error);
  }
  const out: T[] = [];
  const lines = text.split('\n').reverse();
  for (const line of lines) {
    if (out.length >= limit) break;
    const parsed = parseJsonlLine<T>(line);
    if (!parsed) continue;
    if (filter && !filter(parsed)) continue;
    out.push(parsed);
  }
  return out;
}

/** Single-record write — no read-modify-write; safe under concurrency. */
export async function appendJsonlRecord<T extends object>(
  collection: Phase1Collection,
  record: T,
  date = new Date()
): Promise<{ pathname: string }> {
  const month = getMonthKey(date);
  const pathname = recordBlobPathname(collection, record as Record<string, unknown>, month);
  const token = getBlobToken();
  const body = JSON.stringify(record);

  if (!token) {
    await writeLocalJsonRecord(pathname, record);
    return { pathname };
  }

  try {
    await put(pathname, body, {
      token,
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: false,
      addRandomSuffix: false,
    });
  } catch (error) {
    throw new Phase1StorageError('BLOB_APPEND_FAILED', `Unable to write record blob ${pathname}`, error);
  }

  return { pathname };
}

export type ReadPhase1RecordsOptions<T> = {
  limit?: number;
  monthsToScan?: number;
  filter?: (record: T) => boolean;
  /** When set, only loads blobs under `events/{month}/{siteId}/` (avoids scanning unrelated sites). */
  siteId?: string;
};

export async function readJsonlRecords<T>(
  collection: Phase1Collection,
  options?: ReadPhase1RecordsOptions<T>
): Promise<T[]> {
  const limit = Math.max(options?.limit ?? DEFAULT_READ_LIMIT, 1);
  const monthsToScan = Math.max(options?.monthsToScan ?? DEFAULT_MONTHS_TO_SCAN, 1);
  const filter = options?.filter;
  const siteId = options?.siteId;
  const token = getBlobToken();

  if (!token) {
    return readPhase1RecordsLocal<T>(collection, {
      limit,
      monthsToScan,
      filter,
      siteId,
    });
  }

  const months = recentMonthKeys(monthsToScan);

  if (collection === 'snapshots' && siteId) {
    const rows: T[] = [];
    for (const month of months) {
      const prefix = `${PHASE1_PREFIX}/snapshots/${month}/${siteId}/`;
      const paths = await listBlobJsonPathnames(prefix, token);
      for (const pathname of paths) {
        const parsed = await fetchBlobJson<T>(pathname, token);
        if (!parsed) continue;
        if (filter && !filter(parsed)) continue;
        rows.push(parsed);
      }
    }
    rows.sort((a, b) => compareRecordsByGeneratedAt(a, b));
    return rows.slice(0, limit);
  }

  const collected: T[] = [];

  for (const month of months) {
    if (collected.length >= limit) break;

    if (collection === 'events' && siteId) {
      const seenIds = new Set<string>();
      const prefix = `${PHASE1_PREFIX}/events/${month}/${siteId}/`;
      const paths = await listBlobJsonPathnames(prefix, token);
      for (const pathname of paths.sort((a, b) => b.localeCompare(a))) {
        if (collected.length >= limit) break;
        const parsed = await fetchBlobJson<T>(pathname, token);
        if (!parsed) continue;
        if (filter && !filter(parsed)) continue;
        const rid =
          typeof (parsed as unknown as { id?: string }).id === 'string'
            ? (parsed as unknown as { id: string }).id
            : null;
        if (rid) seenIds.add(rid);
        collected.push(parsed);
      }
      const legacy = await readLegacyMonthJsonl<T>(
        'events',
        month,
        token,
        filter,
        limit - collected.length
      );
      for (const row of legacy) {
        if (collected.length >= limit) break;
        const rid =
          typeof (row as unknown as { id?: string }).id === 'string'
            ? (row as unknown as { id: string }).id
            : null;
        if (rid && seenIds.has(rid)) continue;
        if (rid) seenIds.add(rid);
        collected.push(row);
      }
      continue;
    }

    const prefix =
      collection === 'sites'
        ? `${PHASE1_PREFIX}/sites/${month}/`
        : `${PHASE1_PREFIX}/${collection}/${month}/`;

    const paths = await listBlobJsonPathnames(prefix, token);
    for (const pathname of paths.sort((a, b) => b.localeCompare(a))) {
      if (collected.length >= limit) break;
      const parsed = await fetchBlobJson<T>(pathname, token);
      if (!parsed) continue;
      if (filter && !filter(parsed)) continue;
      collected.push(parsed);
    }

    if (collection === 'sites') {
      const legacy = await readLegacyMonthJsonl<T>('sites', month, token, filter, limit - collected.length);
      for (const row of legacy) {
        if (collected.length >= limit) break;
        collected.push(row);
      }
    }
  }

  return collected.slice(0, limit);
}

function compareRecordsByGeneratedAt(a: unknown, b: unknown): number {
  const ga =
    typeof a === 'object' && a !== null && 'generatedAt' in a && typeof (a as { generatedAt: string }).generatedAt === 'string'
      ? Date.parse((a as { generatedAt: string }).generatedAt)
      : 0;
  const gb =
    typeof b === 'object' && b !== null && 'generatedAt' in b && typeof (b as { generatedAt: string }).generatedAt === 'string'
      ? Date.parse((b as { generatedAt: string }).generatedAt)
      : 0;
  return gb - ga;
}

async function readPhase1RecordsLocal<T>(
  collection: Phase1Collection,
  options: { limit: number; monthsToScan: number; filter?: (record: T) => boolean; siteId?: string }
): Promise<T[]> {
  const { limit, monthsToScan, filter, siteId } = options;
  const months = recentMonthKeys(monthsToScan);

  if (collection === 'snapshots' && siteId) {
    const rows: T[] = [];
    for (const month of months) {
      const rel = `${PHASE1_PREFIX}/snapshots/${month}/${siteId}`;
      const batch = await readLocalJsonFiles<T>(rel, filter, 10_000);
      rows.push(...batch);
    }
    rows.sort((a, b) => compareRecordsByGeneratedAt(a, b));
    return rows.slice(0, limit);
  }

  const collected: T[] = [];

  for (const month of months) {
    if (collected.length >= limit) break;

    if (collection === 'events' && siteId) {
      const seenIds = new Set<string>();
      const rel = `${PHASE1_PREFIX}/events/${month}/${siteId}`;
      const batch = await readLocalJsonFiles<T>(rel, filter, limit - collected.length);
      for (const row of batch) {
        if (collected.length >= limit) break;
        const rid =
          typeof (row as unknown as { id?: string }).id === 'string'
            ? (row as unknown as { id: string }).id
            : null;
        if (rid) seenIds.add(rid);
        collected.push(row);
      }
      const legacy = await readLocalLegacyJsonlMonth<T>('events', month, filter, limit - collected.length);
      for (const row of legacy) {
        if (collected.length >= limit) break;
        const rid =
          typeof (row as unknown as { id?: string }).id === 'string'
            ? (row as unknown as { id: string }).id
            : null;
        if (rid && seenIds.has(rid)) continue;
        if (rid) seenIds.add(rid);
        collected.push(row);
      }
      continue;
    }

    if (collection === 'sites') {
      const rel = `${PHASE1_PREFIX}/sites/${month}`;
      const batch = await readLocalJsonFiles<T>(rel, filter, limit - collected.length);
      collected.push(...batch);
      const legacy = await readLocalLegacyJsonlMonth<T>('sites', month, filter, limit - collected.length);
      for (const row of legacy) {
        if (collected.length >= limit) break;
        collected.push(row);
      }
      continue;
    }

    if (collection === 'events' && !siteId) {
      const legacy = await readLocalLegacyJsonlMonth<T>('events', month, filter, limit - collected.length);
      for (const row of legacy) {
        if (collected.length >= limit) break;
        collected.push(row);
      }
    }
  }

  return collected.slice(0, limit);
}

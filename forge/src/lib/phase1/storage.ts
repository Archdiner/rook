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

function monthPath(collection: Phase1Collection, month = getMonthKey()): string {
  return `${PHASE1_PREFIX}/${collection}/${month}.jsonl`;
}

function collectionPrefix(collection: Phase1Collection): string {
  return `${PHASE1_PREFIX}/${collection}/`;
}

function getLocalFallbackPath(pathname: string): string {
  return path.join(LOCAL_FALLBACK_ROOT, pathname);
}

async function appendLocalJsonl(pathname: string, record: object): Promise<void> {
  const filePath = getLocalFallbackPath(pathname);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

async function listLocalMonthPaths(collection: Phase1Collection, limit: number): Promise<string[]> {
  const collectionDir = getLocalFallbackPath(collectionPrefix(collection));
  try {
    const entries = await fs.readdir(collectionDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map((entry) => `${collectionPrefix(collection)}${entry.name}`)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, Math.max(limit, 1));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Phase1StorageError('BLOB_READ_FAILED', `Unable to list local records for ${collection}`, error);
  }
}

async function readLocalJsonlRecords<T>(
  collection: Phase1Collection,
  options: {
    limit: number;
    monthsToScan: number;
    filter?: (record: T) => boolean;
  }
): Promise<T[]> {
  const out: T[] = [];
  const paths = await listLocalMonthPaths(collection, options.monthsToScan);
  for (const pathname of paths) {
    if (out.length >= options.limit) break;
    try {
      const text = await fs.readFile(getLocalFallbackPath(pathname), 'utf8');
      const lines = text.split('\n').reverse();
      for (const line of lines) {
        const parsed = parseJsonlLine<T>(line);
        if (!parsed) continue;
        if (options.filter && !options.filter(parsed)) continue;
        out.push(parsed);
        if (out.length >= options.limit) break;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw new Phase1StorageError('BLOB_READ_FAILED', `Unable to read local records ${pathname}`, error);
    }
  }
  return out;
}

function parseJsonlLine<T>(line: string): T | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

export async function appendJsonlRecord<T extends object>(
  collection: Phase1Collection,
  record: T,
  date = new Date()
): Promise<{ pathname: string }> {
  const token = getBlobToken();
  const pathname = monthPath(collection, getMonthKey(date));
  if (!token) {
    // Local development fallback when Vercel Blob credentials are not configured.
    await appendLocalJsonl(pathname, record);
    return { pathname };
  }

  const newLine = `${JSON.stringify(record)}\n`;
  let existing = '';

  try {
    const meta = await head(pathname, { token });
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (res.ok) {
      existing = await res.text();
    }
  } catch (error) {
    if (!(error instanceof BlobNotFoundError)) {
      throw new Phase1StorageError('BLOB_APPEND_FAILED', `Unable to read existing blob: ${pathname}`, error);
    }
  }

  try {
    await put(pathname, `${existing}${newLine}`, {
      token,
      access: 'public',
      contentType: 'application/x-ndjson',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (error) {
    throw new Phase1StorageError('BLOB_APPEND_FAILED', `Unable to append record to ${pathname}`, error);
  }

  return { pathname };
}

export async function listMonthPaths(
  collection: Phase1Collection,
  limit = DEFAULT_MONTHS_TO_SCAN
): Promise<string[]> {
  const token = getBlobToken();
  if (!token) {
    return listLocalMonthPaths(collection, limit);
  }

  try {
    const result = await list({ token, prefix: collectionPrefix(collection), limit: Math.max(limit, 1) * 3 });
    const seen = new Set<string>();
    for (const entry of result.blobs as BlobLikeEntry[]) {
      if (entry.pathname?.endsWith('.jsonl')) {
        seen.add(entry.pathname);
      }
    }

    return Array.from(seen).sort((a, b) => b.localeCompare(a)).slice(0, Math.max(limit, 1));
  } catch (error) {
    throw new Phase1StorageError('BLOB_READ_FAILED', `Unable to list blobs for ${collection}`, error);
  }
}

export async function readJsonlRecords<T>(
  collection: Phase1Collection,
  options?: {
    limit?: number;
    monthsToScan?: number;
    filter?: (record: T) => boolean;
  }
): Promise<T[]> {
  const token = getBlobToken();
  const limit = Math.max(options?.limit ?? DEFAULT_READ_LIMIT, 1);
  const monthsToScan = Math.max(options?.monthsToScan ?? DEFAULT_MONTHS_TO_SCAN, 1);
  const filter = options?.filter;

  if (!token) {
    return readLocalJsonlRecords<T>(collection, { limit, monthsToScan, filter });
  }

  const out: T[] = [];

  const paths = await listMonthPaths(collection, monthsToScan);
  for (const pathname of paths) {
    if (out.length >= limit) break;
    try {
      const meta = await head(pathname, { token });
      const res = await fetch(meta.url, { cache: 'no-store' });
      if (!res.ok) {
        continue;
      }

      const lines = (await res.text()).split('\n').reverse();
      for (const line of lines) {
        const parsed = parseJsonlLine<T>(line);
        if (!parsed) continue;
        if (filter && !filter(parsed)) continue;
        out.push(parsed);
        if (out.length >= limit) break;
      }
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        continue;
      }
      throw new Phase1StorageError('BLOB_READ_FAILED', `Unable to read blob ${pathname}`, error);
    }
  }

  return out;
}

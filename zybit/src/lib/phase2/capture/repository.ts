/**
 * Capture-specific repository — DB read/write for phase2_page_captures,
 * phase2_capture_assets, and phase2_capture_runs.
 *
 * Separate from Phase1Repository to keep that interface from growing
 * unboundedly. Callers create via `createCaptureRepository()`.
 */

import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  phase2CaptureAssets,
  phase2CaptureRuns,
  phase2PageCaptures,
} from '@/lib/db/schema';
import type { CaptureRunStatus, PageCapture } from './types';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface InsertPageCaptureInput {
  id: string;
  organizationId: string;
  siteId: string;
  runId: string | null;
  pathRef: string;
  capture: PageCapture;
}

export interface InsertCaptureAssetInput {
  organizationId: string;
  siteId: string;
  captureId: string;
  assetType: 'screenshot' | 'har';
  blobUrl: string;
  breakpoint?: string;
  byteSize?: number;
}

export interface UpsertCaptureRunInput {
  id: string;
  organizationId: string;
  siteId: string;
  status: CaptureRunStatus;
  totalPaths: number;
  completedPaths?: number;
  failedPaths?: number;
  totalCostUsd?: number;
  error?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
}

export interface ListRecentPageCapturesInput {
  organizationId: string;
  siteId: string;
  sinceHours?: number;
  limit?: number;
}

export interface CaptureRunRecord {
  id: string;
  siteId: string;
  organizationId: string;
  status: CaptureRunStatus;
  totalPaths: number;
  completedPaths: number;
  failedPaths: number;
  totalCostUsd: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export interface CaptureRepository {
  insertPageCapture(input: InsertPageCaptureInput): Promise<{ id: string }>;
  insertCaptureAsset(input: InsertCaptureAssetInput): Promise<void>;
  upsertCaptureRun(input: UpsertCaptureRunInput): Promise<void>;
  getCaptureRun(id: string): Promise<CaptureRunRecord | null>;
  listRecentPageCaptures(input: ListRecentPageCapturesInput): Promise<PageCapture[]>;
}

export function createCaptureRepository(): CaptureRepository {
  return {
    async insertPageCapture(input) {
      const db = getDb();
      await db.insert(phase2PageCaptures).values({
        id: input.id,
        organizationId: input.organizationId,
        siteId: input.siteId,
        runId: input.runId,
        pathRef: input.capture.pathRef,
        finalUrl: input.capture.finalUrl,
        capturedAt: new Date(input.capture.capturedAt),
        breakpoint: input.capture.breakpoint,
        cohort: input.capture.cohort,
        contentHash: input.capture.contentHash,
        captureData: input.capture as unknown as Record<string, unknown>,
        costUsd: String(input.capture.costUsd),
      });
      return { id: input.id };
    },

    async insertCaptureAsset(input) {
      const db = getDb();
      await db.insert(phase2CaptureAssets).values({
        id: randomUUID(),
        organizationId: input.organizationId,
        siteId: input.siteId,
        captureId: input.captureId,
        assetType: input.assetType,
        blobUrl: input.blobUrl,
        breakpoint: input.breakpoint ?? null,
        byteSize: input.byteSize ?? null,
      });
    },

    async upsertCaptureRun(input) {
      const db = getDb();
      await db
        .insert(phase2CaptureRuns)
        .values({
          id: input.id,
          organizationId: input.organizationId,
          siteId: input.siteId,
          status: input.status,
          totalPaths: input.totalPaths,
          completedPaths: input.completedPaths ?? 0,
          failedPaths: input.failedPaths ?? 0,
          totalCostUsd: String(input.totalCostUsd ?? 0),
          error: input.error ?? null,
          startedAt: input.startedAt,
          completedAt: input.completedAt ?? null,
        })
        .onConflictDoUpdate({
          target: phase2CaptureRuns.id,
          set: {
            status: input.status,
            completedPaths: input.completedPaths ?? 0,
            failedPaths: input.failedPaths ?? 0,
            totalCostUsd: String(input.totalCostUsd ?? 0),
            error: input.error ?? null,
            completedAt: input.completedAt ?? null,
          },
        });
    },

    async getCaptureRun(id) {
      const db = getDb();
      const rows = await db
        .select()
        .from(phase2CaptureRuns)
        .where(eq(phase2CaptureRuns.id, id))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        siteId: row.siteId,
        organizationId: row.organizationId,
        status: row.status as CaptureRunStatus,
        totalPaths: row.totalPaths,
        completedPaths: row.completedPaths,
        failedPaths: row.failedPaths,
        totalCostUsd: parseFloat(String(row.totalCostUsd ?? 0)),
        error: row.error,
        startedAt: row.startedAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
      };
    },

    async listRecentPageCaptures(input) {
      const db = getDb();
      const hoursBack = input.sinceHours ?? 25;
      const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const rows = await db
        .select()
        .from(phase2PageCaptures)
        .where(
          and(
            eq(phase2PageCaptures.organizationId, input.organizationId),
            eq(phase2PageCaptures.siteId, input.siteId),
            gte(phase2PageCaptures.capturedAt, cutoff),
          ),
        )
        .orderBy(desc(phase2PageCaptures.capturedAt))
        .limit(input.limit ?? 200);

      return rows.map(r => r.captureData as unknown as PageCapture);
    },
  };
}

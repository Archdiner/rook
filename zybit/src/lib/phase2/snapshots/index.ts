/**
 * Public surface for the Page DNA snapshot pipeline.
 *
 * Consumers should import from this module rather than the individual
 * files so the pipeline stays substitutable behind one barrel.
 */

import { fetchHtml } from './fetcher';
import { parseSnapshot } from './parser';
import {
  SnapshotError,
  type PageSnapshotData,
  type SnapshotFetchOptions,
} from './types';

export { fetchHtml } from './fetcher';
export { parseSnapshot } from './parser';
export { scoreVisualWeight } from './visualWeight';
export { guessFold } from './foldGuess';
export {
  DEFAULT_SNAPSHOT_FETCH_OPTIONS,
  SnapshotError,
  normalizePathRef,
} from './types';
export type {
  CtaCandidate,
  FoldGuess,
  FormCandidate,
  HeadingItem,
  PageLandmark,
  PageSnapshot,
  PageSnapshotData,
  PageSnapshotMeta,
  SnapshotErrorCode,
  SnapshotFetchOptions,
  SnapshotFetchResult,
  SnapshotRunPathResult,
  SnapshotRunReport,
} from './types';

export interface RunSnapshotResult {
  finalUrl: string;
  data: PageSnapshotData;
  byteSize: number;
}

/**
 * Convenience wrapper: fetch + parse in one call. Any error is normalized
 * to a `SnapshotError` so callers can branch on `code` instead of guessing.
 */
export async function runSnapshot(
  url: string,
  options?: Partial<SnapshotFetchOptions>,
): Promise<RunSnapshotResult> {
  try {
    const fetchResult = await fetchHtml(url, options);
    const data = await parseSnapshot({
      html: fetchResult.html,
      finalUrl: fetchResult.finalUrl,
      rawByteSize: fetchResult.byteSize,
    });
    return {
      finalUrl: fetchResult.finalUrl,
      data,
      byteSize: fetchResult.byteSize,
    };
  } catch (err) {
    if (err instanceof SnapshotError) throw err;
    throw new SnapshotError(
      'UNKNOWN',
      err instanceof Error ? err.message : 'snapshot run failed',
      err,
    );
  }
}

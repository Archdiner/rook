/**
 * Phase 1 (capture): PageCapture v1 schema and supporting types.
 *
 * PageCapture is the artifact produced by a headless browser pass. It
 * supersedes PageSnapshot — same inventory (headings, CTAs, forms) but
 * measured with real bounding boxes, computed styles, and performance
 * metrics rather than heuristics derived from static HTML.
 *
 * Downstream phases consume PageCapture:
 *   - Rules opt in via `AuditRuleContext.pageCapturesByPath` (dual-path with legacy snapshot)
 *   - Phase 4 Brand DNA model reads headings/ctas across all captured pages
 *   - Phase 6 VariantPatch validation resolves selectors against the rendered DOM
 */

import type {
  CtaCandidate,
  FormCandidate,
  FormInputItem,
  HeadingItem,
} from '@/lib/phase2/snapshots/types';

// ---------------------------------------------------------------------------
// Breakpoints and cohorts
// ---------------------------------------------------------------------------

export type CaptureBreakpoint = 'mobile' | 'tablet' | 'desktop';
export type CaptureCohort = 'logged_out' | 'trial' | 'paid' | (string & {});

export const BREAKPOINT_VIEWPORTS: Record<CaptureBreakpoint, { width: number; height: number }> = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

export const CAPTURE_USER_AGENTS: Record<CaptureBreakpoint, string> = {
  mobile:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 ZybitAudit/1.0 (+https://zybit.dev)',
  tablet:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 ZybitAudit/1.0 (+https://zybit.dev)',
  desktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 ZybitAudit/1.0 (+https://zybit.dev)',
};

// ---------------------------------------------------------------------------
// Measured extensions (base snapshot types + real measurements)
// ---------------------------------------------------------------------------

/** Document-coordinate bounding box from getBoundingClientRect() + scroll offsets. */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** HeadingItem with real bounding box and computed type styles. */
export interface HeadingItemMeasured extends HeadingItem {
  bbox: BBox | null;
  fontSizePx: number | null;
  colorHex: string | null;
}

/** CtaCandidate with real bounding box and computed colors. */
export interface CtaCandidateMeasured extends CtaCandidate {
  bbox: BBox | null;
  bgColorHex: string | null;
  fgColorHex: string | null;
}

/** FormInputItem with bounding box and label proximity. */
export interface FormInputItemMeasured extends FormInputItem {
  bbox: BBox | null;
  labelProximityPx: number | null;
}

/** FormCandidate with bounding box and measured inputs. */
export interface FormCandidateMeasured extends Omit<FormCandidate, 'inputs'> {
  bbox: BBox | null;
  inputs: FormInputItemMeasured[];
}

// ---------------------------------------------------------------------------
// Ancillary capture data
// ---------------------------------------------------------------------------

export interface JsError {
  message: string;
  type: string;
  stack: string | null;
  url: string | null;
  line: number | null;
}

export interface ConsoleMessage {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  text: string;
  url: string | null;
  line: number | null;
}

export interface PageCaptureMeta {
  title: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  description: string | null;
  canonical: string | null;
  lang: string | null;
  viewport: string | null;
}

// ---------------------------------------------------------------------------
// PageCapture v1: the canonical headless capture artifact
// ---------------------------------------------------------------------------

export interface PageCapture {
  schemaVersion: 1;
  siteId: string;
  pathRef: string;
  finalUrl: string;
  capturedAt: string;
  breakpoint: CaptureBreakpoint;
  cohort: CaptureCohort;
  /** sha256 of normalized rendered DOM — matches PageSnapshot.data.contentHash. */
  contentHash: string;
  /** Post-hydration outerHTML, capped at 2 MB. */
  renderedHtml: string;
  meta: PageCaptureMeta;
  headings: HeadingItemMeasured[];
  ctas: CtaCandidateMeasured[];
  forms: FormCandidateMeasured[];
  fold: { viewportPx: { w: number; h: number }; foldY: number };
  metrics: { lcpMs: number | null; inpMs: number | null; cls: number | null; ttfbMs: number | null };
  network: {
    totalRequests: number;
    totalBytes: number;
    p95LatencyMs: number;
    thirdPartyDomains: string[];
  };
  errors: JsError[];
  consoleMessages: ConsoleMessage[];
  assets: { screenshotBlobUrl: string | null; harBlobUrl: string | null };
  /** Wall-clock cost estimate in USD for budget tracking. */
  costUsd: number;
}

// ---------------------------------------------------------------------------
// Input / output contracts for orchestration
// ---------------------------------------------------------------------------

export interface CaptureOptions {
  url: string;
  pathRef: string;
  siteId: string;
  organizationId: string;
  /** Defaults to all three breakpoints when omitted. */
  breakpoints?: CaptureBreakpoint[];
  /** Defaults to 'all' when omitted. */
  cohort?: CaptureCohort;
  storageState?: string | null;
  runId: string;
}

export interface CaptureRunSummary {
  runId: string;
  siteId: string;
  captures: PageCapture[];
  failedBreakpoints: CaptureBreakpoint[];
  totalCostUsd: number;
  durationMs: number;
}

export type CaptureRunStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class CaptureError extends Error {
  readonly code: string;

  constructor(code: string, message: string, readonly cause?: unknown) {
    super(message);
    this.code = code;
    this.name = 'CaptureError';
  }
}

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

/** Estimate cost from wall-clock duration at ~$0.00035/s (35¢/hr browser time). */
export function estimateCostUsd(durationMs: number): number {
  const raw = (durationMs / 1000) * 0.00035;
  return Math.max(0.001, Math.round(raw * 10000) / 10000);
}

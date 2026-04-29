/**
 * Phase 2 — Audit rules
 *
 * Audit rules consume canonical events + page snapshots + rollup output
 * and emit findings that name *the actual page elements* — the H1 we
 * saw, the button class signals, the rage-click target, the form field
 * that gets abandoned — so the audit reads as a tasteful designer- /
 * researcher-voiced review rather than a generic metrics dump.
 *
 * Rules cover two flavors:
 *   - **Design**: hierarchy, fold, nav structure, content/promise mismatch.
 *   - **Pain**:   rage, abandonment, hesitation, bounce, error, thrash,
 *                 cohort-pain asymmetry.
 *
 * Rules are pure functions (`evaluate`). They never throw on missing
 * data; they return an empty array. Each rule is responsible for its
 * own minimum-sample threshold so callers can run them blindly across
 * sites without producing noise on small windows.
 */

import type { CanonicalEvent, Phase2SiteConfig, RollupResult, TimeWindow } from '@/lib/phase2/types';
import type { PageSnapshot } from '@/lib/phase2/snapshots/types';

export type AuditFindingSeverity = 'info' | 'warn' | 'critical';

export type AuditFindingCategory =
  // Design-shaped
  | 'hierarchy'        // visual weight vs click share mismatch
  | 'fold'             // above/below the fold coverage problems
  | 'nav'              // nav IA dispersion / over-faceted menus
  | 'mismatch'         // landing promise vs page content mismatch
  // Pain-shaped
  | 'rage'             // rage-click clusters
  | 'asymmetry'        // mobile vs desktop / cohort gap problems
  | 'abandonment'      // form views with no submission, by form
  | 'help'             // help/contact-seeking spike on a non-help page
  | 'hesitation'       // long active dwell with no follow-up click
  | 'bounce'           // single-page sessions on a key page
  | 'error'            // JS exception clusters
  | 'thrash';          // return-visit loops without progression

/**
 * One named piece of structured evidence the rule used to make its
 * call. Rules should populate this generously — finding consumers
 * can render it as "Why we said this" tooltips or full evidence cards.
 */
export interface AuditFindingEvidence {
  label: string;
  value: string | number;
  context?: string;
}

export interface AuditFinding {
  /** Stable, human-readable id, e.g. `hero-hierarchy-inversion:/pricing`. */
  id: string;
  /** Rule that produced this finding. */
  ruleId: string;
  category: AuditFindingCategory;
  severity: AuditFindingSeverity;
  /** 0..1 — heuristic confidence (sample size + signal strength). */
  confidence: number;
  /** 0..1 — heuristic priority (impact × addressability). */
  priorityScore: number;
  /** Page this finding is about. `null` for site-wide findings. */
  pathRef: string | null;
  title: string;
  summary: string;
  /** Designer- / researcher-voiced paragraph(s). Each string is one paragraph. */
  recommendation: string[];
  evidence: AuditFindingEvidence[];
  /**
   * Optional refs into snapshots/CTAs/element ancestry so a UI can deep-link
   * back into the artifact that produced the finding.
   */
  refs?: {
    snapshotId?: string;
    ctaRef?: string;
    elementRef?: string;
    formRef?: string;
  };
}

/**
 * Everything a rule needs to run. The route handler builds this once
 * per request and feeds it to every rule.
 */
export interface AuditRuleContext {
  organizationId: string;
  siteId: string;
  window: TimeWindow;
  config: Phase2SiteConfig;
  events: CanonicalEvent[];
  rollup: RollupResult;
  /** Indexed by `pathRef` for O(1) lookup inside rules. */
  pageSnapshotsByPath: Map<string, PageSnapshot>;
  /** All snapshots, in case a rule wants to iterate site-wide. */
  pageSnapshots: PageSnapshot[];
}

export interface AuditRule {
  id: string;
  category: AuditFindingCategory;
  /** Human-readable rule name for diagnostics/logging. */
  name: string;
  evaluate(ctx: AuditRuleContext): AuditFinding[];
}

/**
 * Helper signature: turn one finding's structured evidence into a
 * recommendation paragraph. Each rule provides its own template; this
 * type just keeps signatures consistent.
 */
export type RecommendationFormatter<T> = (input: T) => string[];

// ----- response shape (used by /api/phase2/insights/run) -----

export interface AuditFindingsReport {
  findings: AuditFinding[];
  /** Rule-level diagnostics for debugging why a rule did/didn't fire. */
  diagnostics: AuditRuleDiagnostic[];
  /** True if at least one snapshot was available for grounding. */
  groundedInSnapshots: boolean;
}

export interface AuditRuleDiagnostic {
  ruleId: string;
  /** How many findings the rule emitted. */
  emitted: number;
  /** Optional reason the rule produced nothing — e.g. INSUFFICIENT_SAMPLE, NO_SNAPSHOT, NO_DEVICE_DATA. */
  skippedReason?: string;
  /** How many candidate paths/cohorts/elements the rule considered. */
  candidatesEvaluated?: number;
}

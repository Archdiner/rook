/**
 * Rule: cohort-pain-asymmetry
 *
 * Measures rage-clicks per session for each cohort within a declared
 * cohort dimension. When the worst cohort sees at least double the
 * site-median rate (and at least 0.05 rage events / session), emit a
 * finding — the friction is cohort-shaped, not page-shaped, and a
 * page-level fix won't move the needle.
 */

import type {
  CanonicalEvent,
  CohortDimensionConfig,
} from "@/lib/phase2/types";

import type { SessionTrace } from "./helpers";
import {
  assignSessionCohort,
  clamp,
  formatCount,
  groupSessions,
  modeStringProp,
  quote,
  round,
  sanitizeIdSegment,
  topByCount,
} from "./helpers";
import type {
  AuditFinding,
  AuditFindingEvidence,
  AuditRule,
  AuditRuleContext,
} from "./types";

const MIN_COHORT_SESSIONS = 50;
const MIN_TOP_RATE = 0.05;
const MULTIPLE_THRESHOLD = 2;
const SEVERITY_MULTIPLE = 4;

interface CohortBucket {
  label: string;
  sessions: SessionTrace[];
  rageEvents: CanonicalEvent[];
  rate: number;
}

export const cohortPainAsymmetry: AuditRule = {
  id: "cohort-pain-asymmetry",
  name: "Cohort pain asymmetry",
  category: "asymmetry",

  evaluate(ctx: AuditRuleContext): AuditFinding[] {
    const sessions = groupSessions(ctx.events);
    if (sessions.length === 0) return [];
    const findings: AuditFinding[] = [];
    for (const dim of ctx.config.cohortDimensions) {
      const finding = evaluateDimension(dim, sessions);
      if (finding !== null) findings.push(finding);
    }
    return findings;
  },
};

function evaluateDimension(
  dim: CohortDimensionConfig,
  sessions: SessionTrace[],
): AuditFinding | null {
  const fallback = typeof dim.fallback === "string" ? dim.fallback : "(unassigned)";

  const buckets = new Map<string, CohortBucket>();
  for (const session of sessions) {
    const label = assignSessionCohort(session, dim);
    let bucket = buckets.get(label);
    if (!bucket) {
      bucket = { label, sessions: [], rageEvents: [], rate: 0 };
      buckets.set(label, bucket);
    }
    bucket.sessions.push(session);
    for (const event of session.events) {
      if (event.type === "rage_click") bucket.rageEvents.push(event);
    }
  }

  const eligible: CohortBucket[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.label === fallback) continue;
    if (bucket.sessions.length < MIN_COHORT_SESSIONS) continue;
    bucket.rate = bucket.rageEvents.length / bucket.sessions.length;
    eligible.push(bucket);
  }

  if (eligible.length < 2) return null;

  const siteMedian = medianOf(eligible.map((b) => b.rate));
  if (siteMedian <= 0) return null;

  eligible.sort((a, b) => {
    if (b.rate !== a.rate) return b.rate - a.rate;
    return a.label.localeCompare(b.label);
  });

  const top = eligible[0];
  if (top.rate < Math.max(siteMedian * MULTIPLE_THRESHOLD, MIN_TOP_RATE)) {
    return null;
  }

  const multiple = top.rate / siteMedian;
  const reference = pickReferenceCohort(eligible);

  return buildFinding({ dim, top, siteMedian, multiple, reference });
}

interface FindingInputs {
  dim: CohortDimensionConfig;
  top: CohortBucket;
  siteMedian: number;
  multiple: number;
  reference: CohortBucket;
}

function buildFinding(inputs: FindingInputs): AuditFinding {
  const { dim, top, siteMedian, multiple, reference } = inputs;

  const summary =
    `On dimension ${quote(dim.label)}, the cohort ${quote(top.label)} shows ${round(top.rate, 3)} ` +
    `rage-clicks per session — ${round(multiple, 1)}× the site median (${round(siteMedian, 3)}). ` +
    `${formatCount(top.sessions.length)} sessions in this cohort.`;

  const para1 =
    `${top.label} users are hitting friction the rest of the audience isn't. Either the surface ` +
    `they land on doesn't match the promise that brought them there (campaign mismatch), or this ` +
    `audience needs a different proof/affordance set. Pull a recording (\`recording_id\` is on the ` +
    `rage events) and watch one before deciding.`;
  const para2 =
    `This is a cohort-level pattern, not a page-level one — fixing a single page won't move the ` +
    `needle. Look for the consistent thread across this cohort's top-rage pages (next paragraph ` +
    `below or in the evidence).`;

  const topPaths = topByCount(top.rageEvents, (e) => e.path).slice(0, 3);
  const cohortEvents = top.sessions.flatMap((s) => s.events);
  const deviceMode = modeStringProp(cohortEvents, "device_type");

  const evidence: AuditFindingEvidence[] = [
    { label: "Dimension", value: dim.label, context: dim.id },
    { label: "Top cohort", value: top.label },
    {
      label: "Rage rate",
      value: round(top.rate, 3),
      context: `${formatCount(top.rageEvents.length)} rage events / ${formatCount(top.sessions.length)} sessions`,
    },
    {
      label: "Site median",
      value: round(siteMedian, 3),
      context: `${round(multiple, 1)}× multiple`,
    },
    {
      label: "Reference cohort",
      value: `${quote(reference.label)} (${round(reference.rate, 3)} rage/sess)`,
    },
  ];
  if (topPaths.length > 0) {
    evidence.push({
      label: "Top rage paths in cohort",
      value: topPaths.map((p) => `${p.key} (${p.count})`).join(", "),
    });
  }
  if (deviceMode !== null) {
    evidence.push({ label: "Top device type in cohort", value: deviceMode });
  }

  return {
    id: `cohort-pain-asymmetry:${sanitizeIdSegment(dim.id)}:${sanitizeIdSegment(top.label)}`,
    ruleId: "cohort-pain-asymmetry",
    category: "asymmetry",
    severity: multiple > SEVERITY_MULTIPLE ? "critical" : "warn",
    confidence: clamp(0.4 + Math.log10(Math.max(top.sessions.length, 1)) * 0.2, 0, 0.95),
    priorityScore: clamp(Math.min(top.rate * 2, 1), 0, 1),
    pathRef: null,
    title: `Cohort ${quote(top.label)} hits ${round(multiple, 1)}× site-median rage rate`,
    summary,
    recommendation: [para1, para2],
    evidence,
  };
}

/**
 * The cohort whose rate sits at the median (lower-of-two for even-sized
 * input). Used as a contrast point in the recommendation.
 */
function pickReferenceCohort(sortedDescByRate: readonly CohortBucket[]): CohortBucket {
  const ascByRate = [...sortedDescByRate].sort((a, b) => {
    if (a.rate !== b.rate) return a.rate - b.rate;
    return a.label.localeCompare(b.label);
  });
  const mid = Math.floor(ascByRate.length / 2);
  if (ascByRate.length % 2 === 1) return ascByRate[mid];
  return ascByRate[mid - 1];
}

function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

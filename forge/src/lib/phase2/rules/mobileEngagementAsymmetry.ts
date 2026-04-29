/**
 * Rule: mobile-engagement-asymmetry
 *
 * Compute step-by-step completion rate for each onboarding step split by
 * `device_type`. When mobile lags desktop by ≥ 15 percentage points
 * across a meaningful sample, the step is failing on small viewports.
 *
 * `OnboardingStepConfig` carries no explicit start/complete event keys,
 * so we derive: a session "starts" step `i` when any of its events
 * matches the step's matcher; it "completes" step `i` when it also
 * matches step `i+1`. The last step has no successor and is skipped.
 */

import type {
  CanonicalEvent,
  OnboardingStepConfig,
} from "@/lib/phase2/types";

import { clamp, formatCount, modeStringProp, pct } from "./helpers";
import type {
  DesignFinding,
  DesignFindingEvidence,
  DesignRule,
  DesignRuleContext,
} from "./types";

const MIN_MOBILE_STARTS = 50;
const MIN_COHORT_STARTS = 30;
const MIN_GAP = 0.15;

interface CohortStats {
  starts: number;
  completes: number;
}

export const mobileEngagementAsymmetry: DesignRule = {
  id: "mobile-engagement-asymmetry",
  name: "Mobile engagement asymmetry",
  category: "asymmetry",

  evaluate(ctx: DesignRuleContext): DesignFinding[] {
    const steps = [...ctx.config.onboardingSteps].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.id.localeCompare(b.id);
    });
    if (steps.length < 2) return [];

    const eventsBySession = groupBySession(ctx.events);
    const deviceBySession = new Map<string, string | null>();
    for (const [sid, events] of eventsBySession) {
      deviceBySession.set(sid, modeStringProp(events, "device_type"));
    }

    const findings: DesignFinding[] = [];

    for (let i = 0; i < steps.length - 1; i += 1) {
      const step = steps[i];
      const next = steps[i + 1];

      const mobile: CohortStats = { starts: 0, completes: 0 };
      const desktop: CohortStats = { starts: 0, completes: 0 };

      for (const [sid, events] of eventsBySession) {
        const startedHere = events.some((event) => matchesStep(event, step));
        if (!startedHere) continue;
        const reachedNext = events.some((event) => matchesStep(event, next));
        const device = deviceBySession.get(sid) ?? null;
        if (device === "mobile") {
          mobile.starts += 1;
          if (reachedNext) mobile.completes += 1;
        } else if (device === "desktop") {
          desktop.starts += 1;
          if (reachedNext) desktop.completes += 1;
        }
      }

      if (mobile.starts < MIN_COHORT_STARTS || desktop.starts < MIN_COHORT_STARTS) {
        continue;
      }
      if (mobile.starts < MIN_MOBILE_STARTS) continue;

      const mobileRate = mobile.completes / mobile.starts;
      const desktopRate = desktop.completes / desktop.starts;
      const gap = desktopRate - mobileRate;
      if (gap <= MIN_GAP) continue;

      findings.push(
        buildFinding({
          step,
          mobileRate,
          desktopRate,
          gap,
          mobileStarts: mobile.starts,
          desktopStarts: desktop.starts,
        }),
      );
    }

    return findings;
  },
};

interface FindingInputs {
  step: OnboardingStepConfig;
  mobileRate: number;
  desktopRate: number;
  gap: number;
  mobileStarts: number;
  desktopStarts: number;
}

function buildFinding(inputs: FindingInputs): DesignFinding {
  const { step, mobileRate, desktopRate, gap, mobileStarts, desktopStarts } = inputs;
  const totalStarts = mobileStarts + desktopStarts;

  const summary =
    `Mobile users complete "${step.label}" at ${pct(mobileRate)}% vs ${pct(desktopRate)}% on ` +
    `desktop — a ${pct(gap)}-point gap across ${formatCount(mobileStarts)} mobile starts and ` +
    `${formatCount(desktopStarts)} desktop starts.`;

  const recommendation: string[] = [
    `Mobile users hit the same step at a meaningfully lower rate — interaction surface is hostile ` +
      `or layout breaks at small viewports. Investigate touch targets, dropdown/select fields, and ` +
      `visual hierarchy on the step "${step.label}" specifically.`,
    `If this step has long select lists or dense form fields, replace with typeahead or stepped ` +
      `reveals. The signal isn't subtle: across ${formatCount(totalStarts)} starts, the device ` +
      `split is the dominant factor.`,
  ];

  const evidence: DesignFindingEvidence[] = [
    { label: "Step", value: step.label },
    {
      label: "Mobile completion",
      value: `${pct(mobileRate)}%`,
      context: `${formatCount(mobileStarts)} starts`,
    },
    {
      label: "Desktop completion",
      value: `${pct(desktopRate)}%`,
      context: `${formatCount(desktopStarts)} starts`,
    },
    {
      label: "Gap",
      value: `${pct(gap)} pp`,
      context: "desktop minus mobile",
    },
  ];

  return {
    id: `mobile-engagement-asymmetry:${step.id}`,
    ruleId: "mobile-engagement-asymmetry",
    category: "asymmetry",
    severity: gap > 0.3 ? "critical" : "warn",
    confidence: clamp(0.5 + Math.log10(Math.max(totalStarts, 1)) * 0.1, 0, 0.95),
    priorityScore: clamp(gap * 2, 0, 1),
    pathRef: null,
    title: `Mobile underperforms desktop on onboarding step "${step.label}"`,
    summary,
    recommendation,
    evidence,
  };
}

function matchesStep(event: CanonicalEvent, step: OnboardingStepConfig): boolean {
  if (step.match.kind === "event-type") {
    return event.type === step.match.type;
  }
  return event.path.startsWith(step.match.prefix);
}

function groupBySession(events: readonly CanonicalEvent[]): Map<string, CanonicalEvent[]> {
  const grouped = new Map<string, CanonicalEvent[]>();
  for (const event of events) {
    let bucket = grouped.get(event.sessionId);
    if (!bucket) {
      bucket = [];
      grouped.set(event.sessionId, bucket);
    }
    bucket.push(event);
  }
  return grouped;
}

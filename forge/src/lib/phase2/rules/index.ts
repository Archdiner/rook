/**
 * Phase 2 — Design rules barrel.
 *
 * Each rule is a pure `DesignRule` that consumes a `DesignRuleContext` and
 * returns zero or more `DesignFinding`s. `runDesignRules` is the orchestration
 * helper the route handler uses; it isolates per-rule errors so a thrown
 * exception in one rule never prevents the others from contributing.
 */

import type {
  DesignFinding,
  DesignFindingSeverity,
  DesignFindingsReport,
  DesignRule,
  DesignRuleContext,
  DesignRuleDiagnostic,
} from "./types";

import { aboveFoldCoverage } from "./aboveFoldCoverage";
import { heroHierarchyInversion } from "./heroHierarchyInversion";
import { mobileEngagementAsymmetry } from "./mobileEngagementAsymmetry";
import { navDispersion } from "./navDispersion";
import { rageClickTarget } from "./rageClickTarget";

export { aboveFoldCoverage } from "./aboveFoldCoverage";
export { heroHierarchyInversion } from "./heroHierarchyInversion";
export { mobileEngagementAsymmetry } from "./mobileEngagementAsymmetry";
export { navDispersion } from "./navDispersion";
export { rageClickTarget } from "./rageClickTarget";

export const ALL_DESIGN_RULES: readonly DesignRule[] = [
  heroHierarchyInversion,
  aboveFoldCoverage,
  rageClickTarget,
  mobileEngagementAsymmetry,
  navDispersion,
];

const SEVERITY_RANK: Record<DesignFindingSeverity, number> = {
  critical: 2,
  warn: 1,
  info: 0,
};

export function runDesignRules(ctx: DesignRuleContext): DesignFindingsReport {
  const findings: DesignFinding[] = [];
  const diagnostics: DesignRuleDiagnostic[] = [];

  for (const rule of ALL_DESIGN_RULES) {
    try {
      const out = rule.evaluate(ctx);
      findings.push(...out);
      diagnostics.push({ ruleId: rule.id, emitted: out.length });
    } catch (err) {
      diagnostics.push({
        ruleId: rule.id,
        emitted: 0,
        skippedReason:
          err instanceof Error ? `THREW:${err.message}` : "THREW",
      });
    }
  }

  findings.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (SEVERITY_RANK[b.severity] !== SEVERITY_RANK[a.severity]) {
      return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    }
    return b.confidence - a.confidence;
  });

  return {
    findings,
    diagnostics,
    groundedInSnapshots: ctx.pageSnapshots.length > 0,
  };
}

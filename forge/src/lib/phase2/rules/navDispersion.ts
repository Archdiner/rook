/**
 * Rule: nav-dispersion
 *
 * Site-wide check on navigation IA. Aggregate every `cta_click` event
 * whose `element_role === 'nav'`, group by destination label, and
 * compute the Gini coefficient over the click counts. A focused IA
 * shows clear preference; a uniform distribution across many entries
 * means the navigation isn't telling visitors where to start.
 */

import { clamp, formatCount, gini, pct, readStringProp, round, share } from "./helpers";
import type {
  AuditFinding,
  AuditFindingEvidence,
  AuditRule,
  AuditRuleContext,
} from "./types";

const MIN_NAV_CLICKS = 50;
const MIN_DISTINCT_DESTS = 6;
const MAX_GINI_FOR_FINDING = 0.3;

export const navDispersion: AuditRule = {
  id: "nav-dispersion",
  name: "Navigation dispersion",
  category: "nav",

  evaluate(ctx: AuditRuleContext): AuditFinding[] {
    const counts = new Map<string, number>();
    let navClicks = 0;

    for (const event of ctx.events) {
      if (event.type !== "cta_click") continue;
      if (readStringProp(event.properties, "element_role") !== "nav") continue;
      const dest = readStringProp(event.properties, "cta_text");
      if (dest === null) continue;
      counts.set(dest, (counts.get(dest) ?? 0) + 1);
      navClicks += 1;
    }

    if (navClicks < MIN_NAV_CLICKS) return [];
    const distinctDests = counts.size;
    if (distinctDests < MIN_DISTINCT_DESTS) return [];

    const countVector = [...counts.values()];
    const giniValue = gini(countVector);
    if (giniValue >= MAX_GINI_FOR_FINDING) return [];

    const ordered = [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    const [topDestText, topDestCount] = ordered[0];
    const topShare = share(topDestCount, navClicks) ?? 0;

    const demoteCount = Math.max(0, distinctDests - 4);

    const summary =
      `${formatCount(navClicks)} nav clicks across ${distinctDests} destinations with Gini ` +
      `${round(giniValue, 3)} — clicks are spread almost uniformly. Visitors aren't being told ` +
      `where to start.`;

    const recommendation: string[] = [
      `Demote ${demoteCount} of the ${distinctDests} top-level entries into a secondary menu and ` +
        `keep only the four destinations that drive the most subsequent activity. Uniform click ` +
        `distribution in a primary nav means the IA isn't doing its job.`,
      `Look at the bottom-share destinations specifically — they are likely earning entry-level ` +
        `prominence they don't need. Move them to footer or a more contextual surface.`,
    ];

    const evidence: AuditFindingEvidence[] = [
      { label: "Nav clicks", value: navClicks },
      { label: "Distinct destinations", value: distinctDests },
      {
        label: "Gini coefficient",
        value: round(giniValue, 3),
        context: "lower = more uniform",
      },
      {
        label: "Top destination share",
        value: `${pct(topShare)}%`,
        context: topDestText,
      },
    ];

    return [
      {
        id: "nav-dispersion",
        ruleId: "nav-dispersion",
        category: "nav",
        severity: giniValue < 0.2 ? "warn" : "info",
        confidence: clamp(0.4 + Math.log10(Math.max(navClicks, 1)) * 0.2, 0, 0.95),
        priorityScore: clamp(1 - giniValue, 0, 1),
        pathRef: null,
        title: "Top-level navigation is unfocused",
        summary,
        recommendation,
        evidence,
      },
    ];
  },
};

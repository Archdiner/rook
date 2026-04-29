import type { InsightFinding } from "./types";

const DEFAULT_MAX_FINDINGS = 3;

export function rankAndDedupeFindings(
  findings: InsightFinding[],
  maxFindings = DEFAULT_MAX_FINDINGS,
): InsightFinding[] {
  assertFindings(findings);
  if (!Number.isInteger(maxFindings) || maxFindings < 1) {
    throw new TypeError("maxFindings must be a positive integer.");
  }

  const filtered = findings.filter((finding) => finding.evidenceRefs.length > 0);
  const deduped = dedupe(filtered);

  return [...deduped]
    .sort((left, right) => {
      const byPriority = right.finding.priorityScore - left.finding.priorityScore;
      if (byPriority !== 0) return byPriority;
      const byConfidence = right.finding.confidence - left.finding.confidence;
      if (byConfidence !== 0) return byConfidence;
      const byEvidence = right.finding.evidenceRefs.length - left.finding.evidenceRefs.length;
      if (byEvidence !== 0) return byEvidence;
      const byId = left.finding.id.localeCompare(right.finding.id);
      if (byId !== 0) return byId;
      return left.index - right.index;
    })
    .slice(0, maxFindings)
    .map((entry) => entry.finding);
}

function dedupe(findings: InsightFinding[]): RankedEntry[] {
  const out: RankedEntry[] = [];
  const seen = new Set<string>();

  findings.forEach((finding, index) => {
    const key = dedupeKey(finding);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ finding, index });
  });

  return out;
}

interface RankedEntry {
  finding: InsightFinding;
  index: number;
}

function dedupeKey(finding: InsightFinding): string {
  const normalizedTitle = finding.title.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedEvidence = [...new Set(finding.evidenceRefs)].sort((a, b) => a.localeCompare(b));
  return `${finding.category}|${normalizedTitle}|${normalizedEvidence.join(",")}`;
}

function assertFindings(findings: InsightFinding[]): void {
  if (!Array.isArray(findings)) {
    throw new TypeError("findings must be an array.");
  }
}

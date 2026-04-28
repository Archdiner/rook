import { rankAndDedupeFindings } from "./rank";
import { evaluateAllRules } from "./rules";
import type { GenerateFindingsOptions, InsightFinding, InsightInput } from "./types";

const DEFAULT_MAX_FINDINGS = 3;

export function generateFindings(
  input: InsightInput,
  options: GenerateFindingsOptions = {},
): InsightFinding[] {
  assertGenerateOptions(options);
  const maxFindings = options.maxFindings ?? DEFAULT_MAX_FINDINGS;

  const findings = evaluateAllRules(input);
  return rankAndDedupeFindings(findings, maxFindings);
}

function assertGenerateOptions(options: GenerateFindingsOptions): void {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("options must be an object.");
  }
  if (
    options.maxFindings !== undefined &&
    (!Number.isInteger(options.maxFindings) || options.maxFindings < 1)
  ) {
    throw new TypeError("options.maxFindings must be a positive integer.");
  }
}

/**
 * Rule: form-abandonment
 *
 * For each `FormCandidate` in a page snapshot whose `fieldCount >= 2`:
 * count distinct sessions that landed on the form's path (`formViews`)
 * and the subset that emitted a `form_submit` event OR a `cta_click`
 * matching the form's likely submit-button label (`formSubmits`). When
 * the submit rate is below 50% across ≥ 100 form views, the form is
 * costing the funnel — emit one finding per form.
 */

import type { FormCandidate, PageSnapshot } from "@/lib/phase2/snapshots/types";
import type { CanonicalEvent } from "@/lib/phase2/types";

import {
  clamp,
  formatCount,
  modeStringProp,
  pct,
  quote,
  readStringProp,
  sanitizeIdSegment,
  share,
} from "./helpers";
import type {
  AuditFinding,
  AuditFindingEvidence,
  AuditRule,
  AuditRuleContext,
} from "./types";

const MIN_FIELD_COUNT = 2;
const MIN_FORM_VIEWS = 100;
const MAX_SUBMIT_RATE = 0.5;
const FALLBACK_SUBMIT_REGEX = /submit|sign\s*up|create|continue/i;

export const formAbandonment: AuditRule = {
  id: "form-abandonment",
  name: "Form abandonment",
  category: "abandonment",

  evaluate(ctx: AuditRuleContext): AuditFinding[] {
    const findings: AuditFinding[] = [];
    if (ctx.pageSnapshots.length === 0) return findings;

    const viewersByPath = new Map<string, Set<string>>();
    const eventsByPath = new Map<string, CanonicalEvent[]>();
    for (const event of ctx.events) {
      let bucket = eventsByPath.get(event.path);
      if (!bucket) {
        bucket = [];
        eventsByPath.set(event.path, bucket);
      }
      bucket.push(event);
      if (event.type === "page_view") {
        let viewers = viewersByPath.get(event.path);
        if (!viewers) {
          viewers = new Set<string>();
          viewersByPath.set(event.path, viewers);
        }
        viewers.add(event.sessionId);
      }
    }

    for (const snapshot of ctx.pageSnapshots) {
      const pathRef = snapshot.pathRef;
      for (const form of snapshot.data.forms) {
        if (form.fieldCount < MIN_FIELD_COUNT) continue;
        const viewers = viewersByPath.get(pathRef);
        const formViews = viewers ? viewers.size : 0;
        if (formViews < MIN_FORM_VIEWS) continue;

        const submitRegex = buildSubmitRegex(form);
        const pathEvents = eventsByPath.get(pathRef) ?? [];
        const submitterSessions = new Set<string>();
        const submitCtaEvents: CanonicalEvent[] = [];
        for (const event of pathEvents) {
          if (!isSubmitEvent(event, submitRegex)) continue;
          submitterSessions.add(event.sessionId);
          if (event.type === "cta_click") submitCtaEvents.push(event);
        }
        const formSubmits = submitterSessions.size;
        const submitRate = share(formSubmits, formViews) ?? 0;
        if (submitRate >= MAX_SUBMIT_RATE) continue;

        findings.push(
          buildFinding({
            snapshot,
            form,
            formViews,
            formSubmits,
            abandonmentRate: 1 - submitRate,
            submitButtonText: modeStringProp(submitCtaEvents, "cta_text"),
          }),
        );
      }
    }
    return findings;
  },
};

interface FindingInputs {
  snapshot: PageSnapshot;
  form: FormCandidate;
  formViews: number;
  formSubmits: number;
  abandonmentRate: number;
  submitButtonText: string | null;
}

function buildFinding(inputs: FindingInputs): AuditFinding {
  const { snapshot, form, formViews, formSubmits, abandonmentRate, submitButtonText } = inputs;
  const pathRef = snapshot.pathRef;
  const requiredLabels = collectRequiredLabels(form);
  const top3Required = requiredLabels.slice(0, 3);
  const top5Required = requiredLabels.slice(0, 5);
  const requiredText =
    top3Required.length > 0 ? top3Required.map(quote).join(", ") : "(no required fields)";

  const summary =
    `Visitors view the ${form.fieldCount}-field form on ${pathRef} ${formatCount(formViews)} ` +
    `times in the window but submit only ${formatCount(formSubmits)} times — ` +
    `${pct(abandonmentRate)}% abandonment. Required fields visible: ${requiredText}.`;

  const requiredCallout =
    top3Required.length >= 2
      ? `${quote(top3Required[0])} and ${quote(top3Required[1])}`
      : top3Required.length === 1
        ? quote(top3Required[0])
        : "the required fields";

  const submitClause =
    submitButtonText !== null && submitButtonText.trim().length > 0
      ? `Submit-button copy reads ${quote(submitButtonText)}; consider a clearer commitment frame ` +
        `(${quote("Get started — no credit card")}) and progressive disclosure for fields that aren't ` +
        `strictly required to ingest the lead.`
      : `Audit the submit-button copy and consider a clearer commitment frame ` +
        `(${quote("Get started — no credit card")}) plus progressive disclosure for fields that ` +
        `aren't strictly required to ingest the lead.`;

  const recommendation: string[] = [
    `${pct(abandonmentRate)}% of visitors don't finish this form. Audit each required field — ` +
      `${requiredCallout} may look optional in the UI but block submission. Either drop them or ` +
      `move them to a second step after the user is invested.`,
    submitClause,
  ];

  const evidence: AuditFindingEvidence[] = [
    { label: "Page", value: pathRef },
    { label: "Form fields", value: form.fieldCount, context: `landmark: ${form.landmark}` },
    { label: "Form views", value: formViews, context: "distinct sessions" },
    { label: "Form submits", value: formSubmits, context: "distinct sessions" },
    { label: "Abandonment rate", value: `${pct(abandonmentRate)}%` },
    {
      label: "Required fields",
      value: top5Required.length > 0 ? top5Required.join(", ") : "(none)",
      context:
        top5Required.length > 0
          ? `top ${top5Required.length} of ${requiredLabels.length}`
          : undefined,
    },
    { label: "Form landmark", value: form.landmark },
  ];

  return {
    id: `form-abandonment:${sanitizeIdSegment(pathRef)}:${sanitizeIdSegment(form.ref)}`,
    ruleId: "form-abandonment",
    category: "abandonment",
    severity: abandonmentRate > 0.85 ? "critical" : "warn",
    confidence: clamp(0.5 + Math.log10(Math.max(formViews, 1)) * 0.15, 0, 0.95),
    priorityScore: clamp(abandonmentRate, 0, 1),
    pathRef,
    title: `High form abandonment on ${pathRef}`,
    summary,
    recommendation,
    evidence,
    refs: { snapshotId: snapshot.id, formRef: form.ref },
  };
}

function buildSubmitRegex(form: FormCandidate): RegExp {
  const labels: string[] = [];
  for (const input of form.inputs) {
    const text = input.labelText;
    if (typeof text !== "string") continue;
    if (!/submit/i.test(text)) continue;
    const trimmed = text.trim();
    if (trimmed.length > 0) labels.push(trimmed);
  }
  if (labels.length === 0) return FALLBACK_SUBMIT_REGEX;
  return new RegExp(labels.map(escapeRegex).join("|"), "i");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSubmitEvent(event: CanonicalEvent, regex: RegExp): boolean {
  if (event.type === "form_submit" || event.type.startsWith("form_submit_")) {
    return true;
  }
  if (event.type === "cta_click") {
    const ctaText = readStringProp(event.properties, "cta_text");
    if (ctaText !== null && regex.test(ctaText)) return true;
  }
  return false;
}

function collectRequiredLabels(form: FormCandidate): string[] {
  const out: string[] = [];
  for (const input of form.inputs) {
    if (!input.required) continue;
    const raw = input.labelText ?? input.name;
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    out.push(trimmed);
  }
  return out;
}

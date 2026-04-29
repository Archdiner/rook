# Phase 2 — live tuning playbook

This runbook is for **operators** validating audit rules against real PostHog (or other) traffic after the integration stack is wired. It pairs with tunable constants in `src/lib/phase2/rules/ruleTuning.ts`.

## 1. Preconditions

- Canonical events are landing for the target `siteId` (sync or webhook).
- Page DNA snapshots exist for high-traffic paths (optional but improves design rules + `groundedInSnapshots`).
- `Phase2SiteConfig` defines real `cohortDimensions` if you test `cohort-pain-asymmetry`.
- Time window covers at least **7 days** of steady traffic for stable medians.

## 2. Smoke run

```bash
SITE_ID=…
# macOS: use `date -u -v-7d` for “7 days ago”. On GNU date: start="$(date -u -d '7 days ago' -Iseconds)".
curl -s -X POST "$BASE/api/phase2/insights/run" \
  -H "Content-Type: application/json" \
  -H "x-org-id: org_…" \
  -d "{\"siteId\":\"$SITE_ID\",\"window\":{\"start\":\"$(date -u -v-7d -Iseconds 2>/dev/null || date -u -d '7 days ago' -Iseconds)\",\"end\":\"$(date -u -Iseconds)\"}}"
```

Check:

- `warnings[]` from the validation gate — investigate `block` before trusting findings.
- `auditReport.findings[]` — severities and evidence look aligned with what you know about the product. (Older APIs may expose `designReport[]` instead — same shape.)
- `auditReport.diagnostics[]` — rules that emitted `0` with `skippedReason` deserve a follow-up data check.

## 3. Calibration loop

1. **Noise** — If a rule fires everywhere, raise its floor in `ruleTuning.ts` (composite absolute floor / sample minimums).
2. **Silence** — If a known breakage never surfaces, capture a minimal event export for one session (`listEventsInWindow`), confirm property coverage (rage target, `\$exception` mapping, cohort keys), lower floors *slightly*.
3. **Cohort pain** — Verify `composite` reacts when only one of rage / errors / shallow sessions spikes; adjust `COHORT_PAIN_WEIGHTS` if product reality differs.

## 4. Regression guard

Snapshot the JSON output (`auditReport`) for two fixtures (demo project + sandbox) whenever you tweak constants — commits should keep diffs reviewable (`diagnostics emitted` counts shifting is expected noise when traffic changes).

## 5. Webhook Segment ingest

Point Segment **HTTP Destination** or custom Forward to:

`POST /api/phase2/integrations/:integrationId/segment-webhook` with `Authorization: Bearer <same value as SECRET_REF resolves to>`.

Batch `{ "batch": [ ... Segment messages ] }` is accepted. Identity-only calls return `mapped: 0` by design.


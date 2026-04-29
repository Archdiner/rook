# Forge — Phase 2 Evidence Model

**Audience:** integrators, design-partner engineers, GTM with technical context.
**Status:** v1 — versioned evidence contract that powers `/api/phase2/*`.

This document is the canonical reference for **what Forge needs in order to produce
trustworthy findings from real customer data**, and how the new Phase 2 contracts
relate to the Phase 1 deterministic engines.

---

## 1. Why Phase 2 exists

Phase 1 ships pure, deterministic engines (sufficiency + insights) but expects the
caller to supply pre-shaped aggregates such as `cohorts[]`, `narratives[]`,
`onboarding[]`, `ctas[]`, `deadEnds[]`. **No commercial analytics tool emits
those shapes natively.** Phase 2 closes the gap with:

- A **versioned canonical event** that connectors and clients can both speak.
- A **per-site config** declaring how a site's events map to cohorts, funnel
  steps, CTAs, and narratives.
- A **rollup pipeline** that turns canonical events + config into the
  Phase 1 `InsightInput`.
- A **validation gate** that emits structured warnings when the engine's output
  is underpowered.
- A single end-to-end route, `POST /api/phase2/insights/run`.

---

## 2. Versioned canonical event (v2)

The Phase 2 ingestion shape is defined in `src/lib/phase2/types.ts` as
`CanonicalEvent` (server-side) and `CanonicalEventInput` (wire shape).

Key v2 additions vs. legacy Phase 1 events:

| Field | Type | Purpose |
| --- | --- | --- |
| `occurredAt` | ISO date | engine-time used for windowing (defaults to `createdAt` if omitted) |
| `source` | `'api' \| 'shopify' \| 'segment' \| 'ga4' \| 'posthog' \| 'custom'` | provenance + dedupe namespace |
| `sourceEventId` | string | external id; uniqueness with `(siteId, source, sourceEventId)` |
| `anonymousId` | string | opaque visitor handle for stitching |
| `properties` | `Record<string, string \| number \| boolean \| null>` | mapped, not raw provider blobs |
| `schemaVersion` | `1 \| 2` | rows ingested via Phase 2 are `2`; legacy rows treated as `1` |

**Backward compatibility.** `POST /api/phase1/events` accepts the new fields
optionally. Clients that send only the old fields keep working unchanged.

**Dedupe.** With `source` and `sourceEventId` set, a unique index in Postgres
(`phase1_events_dedupe_idx`) blocks duplicate inserts. Blob driver dedupes via
linear scan and is documented as the lower-throughput fallback.

---

## 3. Per-site Phase 2 config

`Phase2SiteConfig` declares **how** the site should be analyzed.

| Field | Drives | Required for which finding to fire |
| --- | --- | --- |
| `cohortDimensions[]` | session partitioning by `property`, `metric`, or `path-prefix` | `cohort-asymmetry` |
| `onboardingSteps[]` | ordered funnel matched by `event-type` or `path-prefix` | `onboarding-friction` |
| `ctas[]` | per-page CTA registry with declared `visualWeight` and click matchers | `cta-hierarchy-conflict` |
| `narratives[]` | story page → expected next paths | `narrative-ia-mismatch` |
| `conversionEventTypes[]?` | extends Forge's default conversion set | dead-end + cohort conversion math |

Read & write via `GET / PUT /api/phase2/sites/:siteId/config`.

**Why declarative?** Forge cannot infer "what is your onboarding" or "which
button is your primary CTA" from raw clicks; doing so would defeat the
determinism and explainability Phase 1 promises.

---

## 4. Rollup pipeline

`buildInsightInputFromEvents(ctx, now?)` (in `src/lib/phase2/rollups/`) is a
pure function. Same input → same output.

Pipeline stages:

1. **`filterEventsInWindow`** — keep events with `start <= occurredAt < end`.
2. **`buildCohortAggregates`** — partition sessions by each dimension's value;
   per cohort emit `sessionCount`, `conversionRate`, `avgIntentScore`,
   `evidenceRefs`. `avgIntentScore` defaults to `0.5` when no
   `metrics.intent` is present.
3. **`buildDeadEndAggregates`** — sessions whose **last** in-window event on a
   path did not convert; rage signal from `metrics.rage > 0` or
   `event.type === 'rage_click'`.
4. **`buildOnboardingAggregates`** — entry rate, completion rate, median
   duration to next step, rage rate per declared step.
5. **`buildCtaAggregates`** — clickShare, conversionShare per declared CTA
   per page.
6. **`buildNarrativeAggregates`** — dominant next-path share and mismatch rate
   relative to `expectedPathRefs`.

Output: `RollupResult { insightInput, diagnostics }`. The diagnostics include
`windowDurationMs`, `uniqueSessions`, per-category coverage, and per-source
event counts.

---

## 5. Validation gate

`runInsightInputGate({ rollup, config, window })` emits structured warnings
without changing engine output. Codes (stable in `GateWarning.code`):

| Code | Level | Trigger |
| --- | --- | --- |
| `WINDOW_TOO_SHORT` | warn | window < 24h |
| `LOW_SESSION_COUNT` | warn (<50) / block (<10) | unique sessions in window |
| `COHORT_IMBALANCE` | warn | smallest cohort < 30 and largest/smallest ≥ 5x |
| `EMPTY_NARRATIVES_CONFIG` | info | site has no narrative declarations |
| `EMPTY_ONBOARDING_CONFIG` | info | no onboarding steps |
| `EMPTY_CTA_CONFIG` | info | no CTA registry |
| `NO_DEAD_END_DATA` | info | events present but no path crossed dead-end floor |
| `DOMINANT_SOURCE` | info | one source ≥ 90% of events |

`GateResult.ok = true` iff zero `block` warnings. Routes map this to the
`trustworthy` field of the response.

---

## 6. End-to-end run

`POST /api/phase2/insights/run`

```jsonc
{
  "siteId": "site_123",
  "window": { "start": "2026-04-01T00:00:00Z", "end": "2026-04-22T00:00:00Z" },
  "maxFindings": 5
}
```

Pipeline server-side:

1. Resolve `organizationId` (header > body > query > default per
   `PHASE1_ORG_IDENTITY_MODE`).
2. Load `Phase2SiteConfig` and windowed events in parallel.
3. `buildInsightInputFromEvents` → `runInsightInputGate` → `generateFindings`.
4. Respond with findings, warnings, diagnostics, and `trustworthy`.

---

## 7. What customers must provide (Phase 2 onboarding checklist)

| Step | Action | Where |
| --- | --- | --- |
| 1 | Set storage env: `BLOB_READ_WRITE_TOKEN` and/or `DATABASE_URL` | deployment env |
| 2 | Apply Drizzle migration `drizzle/0000_phase2_canonical_events.sql` (Postgres path) | DB |
| 3 | Create a site: `POST /api/phase1/sites` | API |
| 4 | Declare site config: `PUT /api/phase2/sites/:siteId/config` | API |
| 5 | Send canonical events: `POST /api/phase1/events` (with `occurredAt`, `source`, `sourceEventId`) | API |
| 6 | Run insights: `POST /api/phase2/insights/run` | API |

For the **Postgres** path on existing Forge deployments that already have the
Phase 1 tables, the migration is a baseline + alters. New deployments can
apply it as-is. Operators should review `drizzle/0000_phase2_canonical_events.sql`
and either run it or hand-write the additive `ALTER`s.

---

## 8. Versioning policy

- `CANONICAL_EVENT_SCHEMA_VERSION` is bumped only when **semantic** meaning
  changes; additive nullable fields do not require a bump.
- `Phase2SiteConfig` is unversioned today. If breaking shape changes are
  needed, add `schemaVersion` to the config and gate reads on it.
- Insight rule constants live in `src/lib/phase1/insights/rules.ts` and are
  intentionally stable; gate thresholds (`COHORT_MIN_SESSIONS = 30`,
  `LOW_SESSION_BLOCK = 10`, etc.) mirror them.

---

## 9. PostHog connector (first-class provider)

PostHog is the first integrated provider. Mapping lives in
`src/lib/phase2/connectors/posthog/` and is pure — connectors only do network
I/O; transformation is testable in isolation.

### 9.1 Credential & config checklist

A pilot using PostHog must provide:

| Item | Where it lives |
| --- | --- |
| **Personal API key** with read scope on the project | env var, name documented in `secretRef` (e.g. `POSTHOG_API_KEY__SITE_ABC`) — never in DB |
| **Project id** | `phase2_integrations.config.projectId` |
| **Host** | `phase2_integrations.config.host` (e.g. `https://us.posthog.com`) |
| **Forge site id** | created earlier via `POST /api/phase1/sites` |

The Forge service reads only the env-var name (`secretRef`) from the DB and
resolves the secret server-side at request time. The secret value is never
logged, never returned to clients, and never stored in JSONL.

### 9.2 PostHog → Canonical mapping

| PostHog field | Canonical event field | Notes |
| --- | --- | --- |
| `event` | `type` | `$pageview`→`page_view`, `$pageleave`→`page_leave`, `$autocapture`→`cta_click`, `$rageclick`→`rage_click`. Custom events pass through. |
| `timestamp` | `occurredAt` | Re-emitted as ISO. |
| `uuid` (or `id`) | `sourceEventId` | Powers `(siteId, source, sourceEventId)` dedupe. |
| `distinct_id` (or `person.distinct_id`) | `anonymousId` | Stable visitor handle. |
| `properties.$session_id` → `$window_id` → `session_id` → `distinct_id` | `sessionId` | Falls back to `"unknown_session"`. |
| `properties.$pathname` (or parsed `$current_url`) | `path` | Always begins with `/`. |
| `properties.$duration × 1000` (or `dwell_ms`) | `metrics.dwellMs` | |
| `properties.$scroll_percentage` | `metrics.scrollPct` | |
| `properties.intent` | `metrics.intent` | Clamped 0..1. |
| `$rageclick` event OR `$rage_click_count` | `metrics.rage` | |
| `properties.$revenue` finite | `metrics.conversion = 1` | Documented proxy; see `mapping.ts`. |
| `utm_*`, `$browser`, `$device_type`, `$referrer`, `$host` | `properties.*` | Renamed without `$`. |
| Autocapture: `$el_text`, `$el_attr__data-attr`, `tag_name` | `properties.cta_text`, `properties.cta_id`, `properties.cta_tag` | Powers `CtaConfig.match.property-equals`. |

PII guardrail: `$ip`, `$user_agent`, `email`, `name`, `phone`, raw cookies are
**never** copied across.

### 9.3 Connector API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/phase2/integrations` | Create or upsert by `(siteId, provider)`. Body: `{ siteId, provider, config, secretRef }`. |
| `GET /api/phase2/integrations` | List for the org; optional `siteId`/`provider` filters. |
| `GET /api/phase2/integrations/:id` | Fetch one. |
| `POST /api/phase2/integrations/:id/validate` | Read-only connectivity probe. Returns `{ ok, sampleEvents, recentEventTypes, warnings }`. |
| `POST /api/phase2/integrations/:id/sync` | Pull events, batch-insert with dedupe, advance cursor. Body: `{ since?, until?, maxEvents? }`. |

### 9.4 Sync semantics

- Cursor is `{ lastTimestamp, lastUuid }` persisted in `phase2_integrations.cursor`.
- On 401/403 the integration is marked `status="error"` with code
  `POSTHOG_AUTH`; cursor is preserved.
- 429/5xx are retried with exponential backoff inside the connector
  (`200ms → 800ms → 2400ms`); persistent failures surface as 502 with
  `lastErrorCode` set.
- Per-request timeout: 15s. Sync is page-atomic — partial progress is preserved
  via cursor advancement only after a page is mapped successfully.

### 9.5 Worked example

```bash
curl -X POST $BASE_URL/api/phase2/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "site_123",
    "provider": "posthog",
    "config": { "host": "https://us.posthog.com", "projectId": "12345" },
    "secretRef": "POSTHOG_API_KEY__SITE_123"
  }'

# returns { id, ... }; export it
INTEGRATION_ID=...

curl -X POST $BASE_URL/api/phase2/integrations/$INTEGRATION_ID/validate
# { ok: true, sampleEvents: 42, recentEventTypes: ["cta_click","page_view","rage_click"], warnings: [] }

curl -X POST $BASE_URL/api/phase2/integrations/$INTEGRATION_ID/sync \
  -H "Content-Type: application/json" -d '{ "maxEvents": 1000 }'
# { fetched, inserted, deduped, skipped, errors, cursor, hasMore }
```

After sync, run `POST /api/phase2/insights/run` (§6) and findings are derived
from real PostHog data.

---

## 10. Out of scope for Phase 2 (deferred)

- Other providers (Shopify Admin, Segment write-key receiver, GA4 BigQuery
  export). They reuse the same `Phase2Connector`-shaped path.
- Cron orchestration (Vercel Cron → `/api/phase2/integrations/:id/sync`).
- Identity stitching beyond the `anonymousId` carrier field.
- Outcome/experiment loop (Phase 3).

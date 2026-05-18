# Zybit — Backlog

Prioritized epics and stories toward commercial launch. See [DOCTRINE.md](../DOCTRINE.md) for product vision.

**Convention:** `Zybit-xxx` IDs are logical — map to Linear/GitHub Issues as needed.

---

## What "pilot-ready" means

1. A customer can provision an org, connect telemetry with least privilege, and run insights + audit receipts without a Zybit engineer in the loop.
2. Every strong output is exportable (JSON + Markdown receipt).
3. Access control guarantees no cross-tenant leakage.
4. There is a commercial path: quote → subscription or invoice.
5. A PM can complete the full loop: connect sources → see findings → approve a change → measure the result. Backend-only capability without UX for this loop is not pilot-ready.

---

## Priority tiers

| Tier | Meaning |
|------|---------|
| **P0** | Blocker for any paying customer |
| **P1** | Required for real pilots (10 sites) |
| **P2** | Differentiation and scale |
| **P3** | Enterprise / long tail |

---

## Epic A — Identity, access control, and tenancy

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-001** | Organizations as first-class — users belong to orgs; `siteId`/`organizationId` always resolved from auth. | DB or IdP linkage `(user_id → org_id)`; Phase 2 routes reject mismatched `(body.siteId × org)`. | P0 |
| **Zybit-002** | Auth provider — Clerk middleware protects `/api/phase*` and operator UIs. | Session JWT; `@` routes server-only; webhook for user/org sync. **Superseded — Clerk was removed in `a786d37` ("feat: replace Clerk with invite-only magic-link auth"). Current auth lives in `src/lib/auth/` (`session.ts`, `serverAuth.ts`, `apiKeys.ts`, `tenantScope.ts`). This row needs to be rewritten against the new auth or split into "magic-link sessions" + "org/user sync" sub-stories.** | P0 |
| **Zybit-003** | Machine-to-machine API keys — `Bearer zybit_sk_***` hashed in DB, scopes: `insights:run`, `events:write`, `integrations:manage`. | Rotate, revoke, last-used timestamps; plaintext never stored. | P0 |
| **Zybit-004** | Role-based access — `viewer` / `builder` / `admin`. | Viewer cannot mutate site config or secrets. | P1 |
| **Zybit-005** | Audit log — who ran insights, changed config, exported receipt; append-only. | 90-day retention; CSV export. | P1 |

---

## Epic B — Onboarding

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-010** | Guided onboarding — URL capture, connect PostHog/Segment, validate integration, ingest sample window. | Time to first `trustworthy:true` receipt under 24h assisted. | P0 |
| **Zybit-011** | Improver cockpit — integration health, gate status, job queue, findings backlog, CTAs for Run audit / Export receipt / Preview / Measure. | PMs never need to know about `/phase1` vs `/phase2` to know what to do next. | P0 |
| **Zybit-012** | In-app methodology — gate rules and warning codes documented inline. | Every warning code has an example fix. | P1 |
| **Zybit-013** | Email alerts — Resend templates for gate flip, integration failure, digest. | Quiet hours configurable. | P2 |

---

## Epic C — Data plane reliability

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-020** | PostHog connector scheduling — cron-triggered sync per integration with backoff on cursor failure. | No manual curl for pilot refresh; dashboard shows last-synced timestamp. | P0 |
| **Zybit-021** | Idempotent webhook replay — Segment duplicate `messageId` no double-count. | At-least-once safe; surfaced in integration status. | P1 |
| **Zybit-022** | Backfill tooling — one-command historical window backfill for PostHog. | Support can answer "why did this spike?" from the bundle. | P1 |
| **Zybit-023** | Page snapshot refresh job — scheduled re-fetch; hash drift alerting. | SPA caveat documented until Epic F. | P1 |

---

## Epic D — Credibility receipts

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-030** | Receipt packet schema (`zybit.receipt.v1`) — stable JSON. | **Shipped.** | P0 |
| **Zybit-031** | Markdown receipt — human narrative for Slack/email. | **Shipped.** | P0 |
| **Zybit-032** | Persisted runs — `phase2_insight_runs` table storing run JSON + FK org/site/user. | Sales can show "nothing changed overnight." | P1 |
| **Zybit-033** | Sandbox demo tenant — seeded read-only project + public landing copy. | GTM demo doesn't leak customer data. | P1 |

---

## Epic E — Commercial

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-040** | Stripe billing — products (seat + site-metered), customer portal, webhooks. | No manual license keys; tested with stripe-cli. | P0 |
| **Zybit-041** | Plan limits — max sites, insights run rate cap, retention window on Free tier. | 429 + upgrade hint; enforced in Postgres. | P0 |
| **Zybit-042** | Usage metering — monthly run/snapshot/event counts for invoice line items. | Reconcilable with internal logs. | P1 |
| **Zybit-044** | Privacy and DPAs — subprocessors list; SCCs if EU pilots. | Signable baseline DPA PDF. | P1 |

---

## Epic F — Design DNA fidelity

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-050** | Headless rendered snapshot — Browserless/Playwright behind feature flag; compare static vs rendered diff. | Top 100 paths by traffic only. | P1 |
| **Zybit-051** | CSS token fingerprint — dominant typography/spacing proxies in DNA section of receipt. | Not used to flatten design — only to prove per-site deltas. | P2 |
| **Zybit-052** | Replay deep links in evidence — PostHog session replay URLs in findings when available. | One-click "see session clip" gated by PostHog OAuth. | P2 |

---

## Epic I — Experience layer: connect → understand → preview → measure

The analysis engine is built. This epic builds the product surface that lets a PM complete the loop without touching the API.

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-063** | Multi-source connection UX — guided flow for URL, optional GitHub, PostHog/Segment; per-source validation. | User sees which inputs are required vs optional; failed steps are recoverable. | P0 |
| **Zybit-064** | Baseline jobs and progress — in-app display of sync/snapshot/rollup activity (timestamps, errors, cursor freshness). | PM answers "is Zybit still learning my site?" without reading logs. | P1 |
| **Zybit-065** | Ranked findings backlog — one surface listing audit findings with severity, path, link to evidence. | No need to cross `/phase1` and `/phase2` pages to prioritize. | P0 |
| **Zybit-066** | Preview v1 — per suggestion: store preview artifact (staging URL or deployment preview URL); primary CTA "Open preview." | Stakeholders can see the proposed change before broad rollout. | P0 |
| **Zybit-067** | Production measurement v1 — experiment/rollout object: hypothesis, primary metric, flag key, window, status. | Team can record how production impact will be judged without spreadsheets. | P0 |
| **Zybit-068** | Preview → measure handoff — one flow: finding → Preview → Start measurement. | "See it → ship it → read results" is one navigable path inside Zybit. | P0 |
| **Zybit-069** | Variant and lift visualization — active and past experiment widgets: baseline vs variant trend, confidence callouts. | Pilot can demo impact to leadership from Zybit, with links to customer-owned analytics for drill-down. | P1 |

---

## Epic G — Outcome loops

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-060** | Hypothesis linkage — user pins PostHog insight URL or funnel id to a finding. | Exports cite customer-owned dashboard for lift claims. | P1 |
| **Zybit-061** | Bet status — `planned` / `shipped` / `measured` with owner + date. | CSV export; mirrors lifecycle UI in Epic I. | P2 |
| ~~**Zybit-062**~~ | ~~GitHub PR draft~~ | Out of scope. See "Out of scope — never build." | — |

---

## Epic H — Engineering excellence

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-070** | CI gate — `npm run verify` (lint + tsc + build + migration smoke) on every PR. | GitHub Actions or Vercel checks required for merge on `main`. | P0 |
| **Zybit-071** | Staging environment — separate Postgres + env secrets; seeded non-prod telemetry. | Parity checklist before prod rollout. | P1 |
| **Zybit-072** | Observability — OpenTelemetry spans on connector sync and insights pipeline. | p95 latency dashboard; error budget alerting. | P1 |
| **Zybit-073** | E2E harness — Playwright hits local Next + golden fixture for regression audits. | `auditReport` deterministic from fixture. | P1 |

---

<!-- original 60-day order superseded — see updated execution order at the bottom of this file -->

---

---

## Epic J — Measurement Rigor (the keystone)

**This is the critical path. Nothing else in the loop matters until outcomes are computed correctly.**

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-080** | Outcome storage table — `zybit_experiment_outcomes` with `(experimentId, findingId, ruleId, pathRef, modificationType, result, liftPct, confidence, controlConversions, controlParticipants, variantConversions, variantParticipants, guardrailBreached, concludedAt)`. | Migration ships; row inserted when experiment reaches `completed` or `stopped`. **Shipped — `5951a99` (`drizzle/0011_experiment_outcomes.sql`, `schema.ts:460`).** | P0 |
| **Zybit-081** | Conversion join — join `experiment_assignment` canonical events to `primaryMetric` events by `(visitorId, occurredAt > assignedAt, occurredAt <= assignedAt + durationDays)`; compute unique converters per bucket. | Results match manual verification on a synthetic fixture. No double-counting per visitor. **Shipped — `5951a99`, hardened by `b09a212` (`DISTINCT ON session_id` in assignments CTE). Known gap: PostHog-sourced conversions are undercounted until the visitor-ID bridge lands (see `computeOutcomes.ts:13`).** | P0 |
| **Zybit-082** | Chi-squared significance — chi-squared test for proportion comparison (not pooled-variance z-test); Welch's t-test for continuous metrics; output: p-value, confidence. | Pure function with unit tests covering edge cases (zero conversions, very small samples). **Math shipped — `5951a99` (`stats.ts`), alpha param fix in `b09a212`. Unit tests for `stats.ts` not yet written — only `bucketing.test.ts` and `htmlModifier.test.ts` exist in `__tests__/`. AC not fully satisfied.** | P0 |
| **Zybit-083** | Sequential testing guard — significance cannot be declared unless: `confidence >= 0.95` AND `participants >= minimumSampleSize(baseRate, MDE=5%, power=80%)` AND `elapsedDays >= 7`. Minimum sample calculation is pre-computed when experiment starts. | Fixture: high confidence at day 2 with 30 visitors does not auto-stop. **Shipped — `5951a99` (`isReadyToStop` + `minimumSampleSizePerArm` in `stats.ts`), per-arm guard fix in `b09a212`.** | P0 |
| **Zybit-084** | Auto-stop on significance — when both conditions met: transition to `completed`, write outcome row, send PM notification via Resend. When `durationDays` elapsed without significance: transition to `completed` as `inconclusive`. | Cron run idempotent: re-running on an already-completed experiment is a no-op. **Shipped — `5951a99` (`computeOutcomes.ts` status transition + `classifyResult`). Resend PM-notification path not yet wired.** | P0 |
| **Zybit-085** | Guardrail evaluation — evaluate each guardrail metric on each cron run; if breached with >80% confidence in wrong direction: transition to `stopped`, set `guardrailBreached = true` on outcome row, notify PM with which guardrail and by how much. | Proxy stops variant on next Edge Config sync (within 30s). **Shipped — `5951a99` (`guardrailOneSidedPValue` + evaluator in `computeOutcomes.ts`). Auto-rollback wiring to proxy depends on Zybit-104.** | P0 |
| **Zybit-086** | Compute-outcomes cron — `POST /api/phase2/cron/compute-outcomes` runs hourly; processes all `running` experiments; idempotent. | Cronitor dead-man's-switch ping at start and completion. Dashboard shows "last computed at" timestamp. **Shipped — `5951a99` (`api/phase2/cron/compute-outcomes/route.ts`, scheduled `0 * * * *` in `vercel.json`, `cronitorPing` at start/success/fail). "Last computed at" dashboard surface not yet built.** | P0 |

---

## Epic K — Visible Loop View

**The renewal story. The demo that beats "ChatGPT can do this" in 10 seconds.**

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-090** | Loop timeline page — `/app/loop` (or `/app/activity`): top-level page showing full cycle per site. Not buried in finding detail. | Shows entries for: detection, experiment deployed, result, learning (suppressed / boosted). | P0 |
| **Zybit-091** | Detection entry — "Zybit detected [finding title] on [page] — [one-line evidence summary]" with timestamp. Links to finding detail. | Populated from `zybit_findings.createdAt` + evidence. | P0 |
| **Zybit-092** | Experiment result entry — "Variant [X]% vs Control [Y]% — +[N]pp ([Z]% relative), [p=confidence]" with stop/completion timestamp. Shows guardrail status if breached. | Populated from `zybit_experiment_outcomes`. Requires Epic J. | P0 |
| **Zybit-093** | Learning entry — "Signal raised: you tested [rule] on [page], result was [outcome]. Threshold now requires stronger signal." with timestamp. | Populated when rule calibration runs. Requires per-site outcome feedback (after Epic J). | P1 |
| **Zybit-094** | Experiment lift widget — confidence bar showing current confidence vs 95% threshold; control vs variant rate as live numbers; updated on each cron run. | Visible on experiment detail page. | P1 |

---

## Epic L — Proxy Reliability

**Non-negotiable before any paid pilot routes real production traffic.**

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-100** | Fail-open behavior — if proxy modification fails for any reason (config load failure, HTML rewrite error, network error to origin), the request is served from origin unchanged. No 5xx to end user. | Load test: kill Edge Config; verify 100% of requests get valid origin response. | P0 |
| **Zybit-101** | Kill switch — PM stops experiment via dashboard; proxy stops applying variant within 30s (Edge Config TTL). No DNS changes, no redeployment. | "Stop experiment" button transitions to `stopped`, Edge Config sync removes from active manifest, next request after TTL serves control. | P0 |
| **Zybit-102** | SPA detection and Browserless fallback (audit engine) — detect JS-rendered pages (empty body heuristic); re-fetch via Browserless.io; store `snapshotMethod` on snapshot record; surface SPA warning in cockpit when Browserless is unavailable. | Static fixture with `<div id="root"></div>` triggers Browserless path. HTTP fallback when `BROWSERLESS_TOKEN` absent. | P0 |
| **Zybit-103** | SPA proxy handling — validate at experiment creation time that modifications targeting SPA-routed paths are HTML-injectable (CSS/attribute/text on initial render, not post-hydration). Surface warning if not. | Experiment creation rejects or warns modifications that require post-hydration DOM state. | P1 |
| **Zybit-104** | Auto-rollback wiring — guardrail breach (Epic J, Zybit-085) automatically removes experiment from Edge Config active manifest; proxy serves control without manual intervention. | End-to-end: guardrail breaches, experiment transitions to `stopped`, next proxied request within 30s is control. | P0 |

---

## Epic M — Activation (first finding in <24h)

**The activation moment that determines whether a trial converts.**

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **Zybit-110** | GA4 connector — pull-sync via Google Analytics Data API v1beta; service account auth; map GA4 event names to canonical event types; cursor on last-synced date. Same pattern as PostHog connector. | PM connects GA4 in onboarding wizard, events appear in canonical stream within 1 hour. | P0 |
| **Zybit-111** | Integration health cockpit — show last-sync timestamp, event count, and error state for each connected integration. "Zybit is watching your site" vs "integration degraded" vs "no data yet." | PM answers "is Zybit learning my site?" without reading logs. | P0 |
| **Zybit-112** | Preview before deploy — `GET /api/preview/[experimentId]`: fetch origin HTML, apply modifications as inline style injections and DOM mutations, return modified HTML for iframe. Dashboard: side-by-side control/variant iframe toggle. | No external dependency. Modifications applied correctly for CSS-inject and text-replace types. **Shipped — `5951a99` (`api/preview/[experimentId]/route.ts`: auth, ownership check, 8s origin timeout, modification apply, preview banner), HTML injection fix in `b09a212`. Outstanding: (1) strip `X-Frame-Options` / `Content-Security-Policy: frame-ancestors` from the response so iframes render in the dashboard (`route.ts:124` TODO); (2) dashboard side-by-side iframe UI on the experiment detail page.** | P0 |
| **Zybit-113** | MRR/AOV capture in connect flow — required step in onboarding wizard (not optional). Unlocks revenue-impact framing on all findings from day one. | Cannot complete onboarding without entering at least one of MRR or AOV. Values stored in `zybit_site_meta`. | P1 |
| **Zybit-114** | Auto-populate MRR/AOV from customer billing — if the PM connects Stripe (or future: Chargebee, Paddle, Recurly) in onboarding step 4, pull live MRR + AOV from their billing API instead of asking them to type numbers. Manual input remains as fallback. Reduces friction at the activation moment and keeps revenue framing accurate as their business grows. | When Stripe is connected, MRR/AOV fields auto-fill with the last 30 days of revenue ÷ 1 month and average successful charge amount. PM can override. Values refresh on a daily cron. Stored in `zybit_site_meta` with a `source` column (`'manual'` vs `'stripe'`). | P2 |

---

## Suggested execution order (updated)

> **Status note (2026-05-18):** Epic J (measurement rigor) and Zybit-112 (preview) are largely shipped — see commits `5951a99` and `b09a212`. The remaining week-1 tail is small (stats unit tests, X-Frame-Options strip, dashboard surfaces). Real critical path now starts at Epic K + Epic L.

| Block | Focus | Stories |
|-------|-------|---------|
| **Week-1 tail (small)** | Close shipped-but-incomplete acceptance criteria | `stats.ts` unit tests (Zybit-082), `X-Frame-Options` strip + side-by-side iframe UI (Zybit-112), "last computed at" surface (Zybit-086), Resend notification on auto-stop (Zybit-084) |
| **Now** | Visible loop view | Zybit-090 through Zybit-092 (Epic K) — `/app/loop/page.tsx` is a TODO scaffold today |
| **Next** | Proxy reliability + SPA | Zybit-100 through Zybit-104 (Epic L) — `proxy/handler.ts` TODOs at lines 100/129/153/159; `browserFetcher.ts` is unimplemented |
| **Then** | GA4 connector + integration health | Zybit-110, Zybit-111 (Epic M) |
| **Then** | Per-site outcome feedback into rules | Zybit-060 (Epic G), updated rules in `src/lib/phase2/rules/` |
| **Polish** | Visible loop enrichment + activation polish | Zybit-093, Zybit-094, Zybit-113 |
| **Later** | Amplitude / Mixpanel connectors | Same pattern as GA4 — one at a time |
| **50+ customers** | Cross-site global priors | Zybit from Epic (deferred) |

---

## Out of scope — never build

- Sentiment analysis or voice-of-customer NLP
- GitHub PR generation or code deployment integration
- Own event collection SDK / PostHog replacement / behavioral event ingestion layer
- Elaborate new audit rules (bottleneck is measurement, not rule count)
- Cross-site global priors before 50+ customers with real outcome data
- Replacing Shopify / CMS authoring
- Guaranteed lift refunds without externally auditable KPIs
- Silent autonomous production merges without PM approval

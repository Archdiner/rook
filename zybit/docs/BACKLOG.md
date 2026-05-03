# Zybit — Backlog

Prioritized epics and stories toward commercial launch. See [DOCTRINE.md](../DOCTRINE.md) for product vision.

**Convention:** `FORGE-xxx` IDs are logical — map to Linear/GitHub Issues as needed.

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
| **FORGE-001** | Organizations as first-class — users belong to orgs; `siteId`/`organizationId` always resolved from auth. | DB or IdP linkage `(user_id → org_id)`; Phase 2 routes reject mismatched `(body.siteId × org)`. | P0 |
| **FORGE-002** | Auth provider — Clerk middleware protects `/api/phase*` and operator UIs. | Session JWT; `@` routes server-only; webhook for user/org sync. | P0 |
| **FORGE-003** | Machine-to-machine API keys — `Bearer zybit_sk_***` hashed in DB, scopes: `insights:run`, `events:write`, `integrations:manage`. | Rotate, revoke, last-used timestamps; plaintext never stored. | P0 |
| **FORGE-004** | Role-based access — `viewer` / `builder` / `admin`. | Viewer cannot mutate site config or secrets. | P1 |
| **FORGE-005** | Audit log — who ran insights, changed config, exported receipt; append-only. | 90-day retention; CSV export. | P1 |

---

## Epic B — Onboarding

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **FORGE-010** | Guided onboarding — URL capture, connect PostHog/Segment, validate integration, ingest sample window. | Time to first `trustworthy:true` receipt under 24h assisted. | P0 |
| **FORGE-011** | Improver cockpit — integration health, gate status, job queue, findings backlog, CTAs for Run audit / Export receipt / Preview / Measure. | PMs never need to know about `/phase1` vs `/phase2` to know what to do next. | P0 |
| **FORGE-012** | In-app methodology — gate rules and warning codes documented inline. | Every warning code has an example fix. | P1 |
| **FORGE-013** | Email alerts — Resend templates for gate flip, integration failure, digest. | Quiet hours configurable. | P2 |

---

## Epic C — Data plane reliability

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **FORGE-020** | PostHog connector scheduling — cron-triggered sync per integration with backoff on cursor failure. | No manual curl for pilot refresh; dashboard shows last-synced timestamp. | P0 |
| **FORGE-021** | Idempotent webhook replay — Segment duplicate `messageId` no double-count. | At-least-once safe; surfaced in integration status. | P1 |
| **FORGE-022** | Backfill tooling — one-command historical window backfill for PostHog. | Support can answer "why did this spike?" from the bundle. | P1 |
| **FORGE-023** | Page snapshot refresh job — scheduled re-fetch; hash drift alerting. | SPA caveat documented until Epic F. | P1 |

---

## Epic D — Credibility receipts

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **FORGE-030** | Receipt packet schema (`zybit.receipt.v1`) — stable JSON. | **Shipped.** | P0 |
| **FORGE-031** | Markdown receipt — human narrative for Slack/email. | **Shipped.** | P0 |
| **FORGE-032** | Persisted runs — `phase2_insight_runs` table storing run JSON + FK org/site/user. | Sales can show "nothing changed overnight." | P1 |
| **FORGE-033** | Sandbox demo tenant — seeded read-only project + public landing copy. | GTM demo doesn't leak customer data. | P1 |

---

## Epic E — Commercial

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **FORGE-040** | Stripe billing — products (seat + site-metered), customer portal, webhooks. | No manual license keys; tested with stripe-cli. | P0 |
| **FORGE-041** | Plan limits — max sites, insights run rate cap, retention window on Free tier. | 429 + upgrade hint; enforced in Postgres. | P0 |
| **FORGE-042** | Usage metering — monthly run/snapshot/event counts for invoice line items. | Reconcilable with internal logs. | P1 |
| **FORGE-044** | Privacy and DPAs — subprocessors list; SCCs if EU pilots. | Signable baseline DPA PDF. | P1 |

---

## Epic F — Design DNA fidelity

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **FORGE-050** | Headless rendered snapshot — Browserless/Playwright behind feature flag; compare static vs rendered diff. | Top 100 paths by traffic only. | P1 |
| **FORGE-051** | CSS token fingerprint — dominant typography/spacing proxies in DNA section of receipt. | Not used to flatten design — only to prove per-site deltas. | P2 |
| **FORGE-052** | Replay deep links in evidence — PostHog session replay URLs in findings when available. | One-click "see session clip" gated by PostHog OAuth. | P2 |

---

## Epic I — Experience layer: connect → understand → preview → measure

The analysis engine is built. This epic builds the product surface that lets a PM complete the loop without touching the API.

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **FORGE-063** | Multi-source connection UX — guided flow for URL, optional GitHub, PostHog/Segment; per-source validation. | User sees which inputs are required vs optional; failed steps are recoverable. | P0 |
| **FORGE-064** | Baseline jobs and progress — in-app display of sync/snapshot/rollup activity (timestamps, errors, cursor freshness). | PM answers "is Zybit still learning my site?" without reading logs. | P1 |
| **FORGE-065** | Ranked findings backlog — one surface listing audit findings with severity, path, link to evidence. | No need to cross `/phase1` and `/phase2` pages to prioritize. | P0 |
| **FORGE-066** | Preview v1 — per suggestion: store preview artifact (staging URL or deployment preview URL); primary CTA "Open preview." | Stakeholders can see the proposed change before broad rollout. | P0 |
| **FORGE-067** | Production measurement v1 — experiment/rollout object: hypothesis, primary metric, flag key, window, status. | Team can record how production impact will be judged without spreadsheets. | P0 |
| **FORGE-068** | Preview → measure handoff — one flow: finding → Preview → Start measurement. | "See it → ship it → read results" is one navigable path inside Zybit. | P0 |
| **FORGE-069** | Variant and lift visualization — active and past experiment widgets: baseline vs variant trend, confidence callouts. | Pilot can demo impact to leadership from Zybit, with links to customer-owned analytics for drill-down. | P1 |

---

## Epic G — Outcome loops

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **FORGE-060** | Hypothesis linkage — user pins PostHog insight URL or funnel id to a finding. | Exports cite customer-owned dashboard for lift claims. | P1 |
| **FORGE-061** | Bet status — `planned` / `shipped` / `measured` with owner + date. | CSV export; mirrors lifecycle UI in Epic I. | P2 |
| **FORGE-062** | GitHub PR draft (optional) — unified diff from snapshot-scoped suggestion; never merge without OAuth approval. | Rate-limited; scoped to repo whitelist. | P3 |

---

## Epic H — Engineering excellence

| ID | Story | Acceptance criteria | Tier |
|----|-------|---------------------|------|
| **FORGE-070** | CI gate — `npm run verify` (lint + tsc + build + migration smoke) on every PR. | GitHub Actions or Vercel checks required for merge on `main`. | P0 |
| **FORGE-071** | Staging environment — separate Postgres + env secrets; seeded non-prod telemetry. | Parity checklist before prod rollout. | P1 |
| **FORGE-072** | Observability — OpenTelemetry spans on connector sync and insights pipeline. | p95 latency dashboard; error budget alerting. | P1 |
| **FORGE-073** | E2E harness — Playwright hits local Next + golden fixture for regression audits. | `auditReport` deterministic from fixture. | P1 |

---

## Suggested execution order (first 60 days)

| Week block | Focus |
|------------|-------|
| **1–2** | FORGE-001, 002, 003, 070 — auth + API keys + CI |
| **3–4** | FORGE-020, 010, 041 — ingestion reliability + onboarding + quotas; spike Epic I shells (063, 065, 066, 067, 068) |
| **5–6** | FORGE-011 cockpit + Epic I hardening + FORGE-040 Stripe + staging (071) |
| **7–8** | FORGE-032 persisted runs + FORGE-069 visualization + observability (072) |

Epic I must run in parallel with the data plane — not after it.

---

## Out of scope

- Replacing Shopify / CMS authoring
- Guaranteed lift refunds without externally auditable KPIs
- Silent autonomous production merges without PM approval

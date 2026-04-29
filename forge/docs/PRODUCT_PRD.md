# Forge — Product Requirements (full scope, Phases 0–4)

**Audience:** Founders, product, engineering, GTM  
**Repo:** `forge/` (Next.js App Router)  
**Status:** Living document — aligns roadmap with shipped code where noted.

This is the **canonical, version-controlled** product narrative. For private scratch notes, use a local file such as `forge/PRD.full.md` (gitignored if listed in `forge/.gitignore`).

---

## 1. Executive summary

**Forge** helps teams decide **what to ship next** by grounding prioritization in **observed user behavior**, not opinion alone. The product combines:

- **Intake & discovery** (Phase 0) to validate problems and recruit design partners.
- **Deterministic analysis** (Phase 1+) — sufficiency, readiness, insights, recommendations — exposed via HTTP APIs and optional operator UI.
- **Longer-term** (Phases 2–4): deeper integrations, closed loops for actions and outcomes, and production-grade multi-tenant operations.

Success is measured by **decision quality** (fewer bad bets), **time-to-confidence** (how fast teams know they have enough signal), and **pilot traction** (sites onboarded, events flowing, outputs consumed).

---

## 2. Problem statement

Product and growth teams routinely suffer from:

1. **Premature shipping** — changes go live without enough behavioral evidence.
2. **Opaque prioritization** — roadmaps rest on anecdotes; stakeholders cannot audit criteria.
3. **Tool sprawl** — analytics and session tools accumulate without a shared bar for “enough data” or “what to try next.”

Forge addresses this by making **sufficiency and readiness explicit**, producing **ranked, explainable outputs** suitable for reviews, docs, and sales narratives.

---

## 3. Product vision

Forge becomes the **decision layer** between telemetry and execution: ingest structured signals, judge whether conclusions are justified, surface ranked insights, and recommend next actions with explicit confidence.

Long-term, Forge pairs deterministic cores with richer integrations and outcome feedback. Near-term, Forge ships a **thin vertical slice**: ingest → score → recommend → inspect.

---

## 4. Personas

| Persona | Needs |
| --- | --- |
| **Operator PM / growth** | Defensible prioritization; transparent “why we believe we have enough signal.” |
| **Engineer (integrations)** | Stable APIs, predictable validation errors, sensible dev vs prod config. |
| **Founder / GTM** | A credible pilot story: week-one value, proof definition, pricing experiments. |

---

## 5. Phases — scope and deliverables

### Phase 0 — Discovery & problem validation

**Goal:** Validate that the problem matters and recruit honest signal from target users.

**In scope:**

- Discovery survey UI (`/discovery`) and API (`POST /api/discovery`).
- Email delivery via Resend; optional persistence of responses (one JSON blob per submission to avoid concurrent overwrite on aggregated logs).
- Honeypot / anti-spam field; shared server/client validation (Zod-backed schema).
- Intake patterns for adjacent flows (`/api/intake` as applicable).

**Success criteria:**

- Operators can run a discovery loop without engineering support every week.
- Responses are attributable and exportable (email + stored artifact when Blob configured).

**Non-goals:** Full CRM, billing, or SSO.

---

### Phase 1 — Sufficiency, readiness, insights core

**Goal:** Ship a **deterministic analysis core** and **repository-backed APIs** so real traffic can flow without rebuilding foundations.

**In scope:**

- **Engines:** Sufficiency (`evaluateAllCategories`), readiness snapshot derivation from events, heuristic recommendations, insights rules over structured aggregates.
- **HTTP API:** `/api/phase1/*` — health, sites, events, readiness, recommendations, sufficiency, insights.
- **Persistence:** Org-aware repository — **Vercel Blob** with **partitioned JSON per record** (no read-modify-write append on shared NDJSON for Phase 1 collections); **Postgres** via Drizzle for production-shaped workloads; local fallback when Blob token absent.
- **Readiness:** Computes snapshots using the real sufficiency engine (aggregated evidence from events); persists snapshots to Postgres when using the Postgres driver.
- **Tenancy:** Configurable org identity (`PHASE1_ORG_IDENTITY_MODE`: dev vs `header_required`).
- **Operator UI:** Phase 1 dashboard (`/phase1`) for simulation / demos.

**Success criteria:**

- `npm run build` passes; APIs documented via README quickstart.
- End-to-end: site → events → readiness → recommendations on blob or Postgres configuration.
- No silent data loss from concurrent Blob writes for Phase 1 record types.

**Non-goals:** ML personalization, full SaaS billing, enterprise SSO.

---

### Phase 2 — Deeper instrumentation & evidence models

**Goal:** Meet production teams where their data lives — richer events, mappings from analytics providers, and stronger cohort / funnel semantics.

**In scope (directional):**

- Provider-specific connectors or documented mapping layers (e.g. Shopify, Segment-style taxonomies).
- Richer **event schema** (versioned), deduplication strategy, identity stitching hooks.
- Stronger validation of aggregates feeding insights (sampling bias, time windows).

**Success criteria:**

- Fewer manual transforms between customer warehouses and Forge inputs.
- Evidence models documented and versioned.

**Non-goals:** Owning the entire CDP or warehouse product surface.

---

### Phase 3 — Guided action loops & outcome tracking

**Goal:** Close the loop from **recommendation → shipped change → measured outcome**.

**In scope (directional):**

- Experiments or “bets” linked to recommendations; tracking uplift vs baseline.
- Operator workflows: assign owners, deadlines, status on findings.
- Notifications (email/Slack) for readiness thresholds and shipped outcomes.

**Success criteria:**

- Pilots can answer “did the recommended change move the metric?” within an agreed window.

**Non-goals:** Full project management suite.

---

### Phase 4 — Production hardening & broad rollout

**Goal:** Operate reliably at scale with clear SLAs, security posture, and cost visibility.

**In scope (directional):**

- Rate limits, audit logs, backup/restore story for Postgres artifacts.
- Performance budgets for API latency and worker-style aggregation jobs if needed.
- SOC2-minded practices where required by customers.

**Success criteria:**

- Production checklist passes for target customer segment; on-call runbooks exist.

---

## 6. Cross-cutting requirements

### 6.1 APIs & contracts

- JSON envelopes with stable error codes where applicable (`success`, `data`, `error`).
- Versioning strategy for breaking API changes (path or header versioning when needed).

### 6.2 Determinism

- Given identical engine inputs, outputs are identical (no hidden randomness in Phase 1 cores).

### 6.3 Storage strategy

- **Discovery:** Prefer **one object per submission** (pathname includes id) to avoid Blob append races.
- **Phase 1 Blob driver:** **One JSON file per site/event/snapshot record** under month + partition prefixes; listing scoped by `siteId` where applicable.
- **Postgres:** Schema migrations applied for sites, events, readiness snapshots; prefer Postgres for high-volume multi-site production workloads.

### 6.4 Security & tenancy

- Org resolution via `x-org-id` / query / body (dev) vs strict header mode (prod-style shared environments).

---

## 7. Metrics (north stars)

| Area | Metric |
| --- | --- |
| Activation | Sites created + events ingested + readiness/recommendations fetched successfully |
| Quality | % of recommendations acted on in pilots (manual tracking early) |
| Engineering | Build green; smoke tests for critical APIs |

---

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Sparse data → wrong confidence | Sufficiency thresholds; readiness states communicate uncertainty |
| Blob concurrency / growth | Partitioned objects; Postgres for heavy workloads |
| Tenant leakage | `header_required` org mode; tests for org filters |

---

## 9. Open questions

- Pilot success definition: conversion lift vs velocity of decisions vs revenue?
- First analytics providers to prioritize for Phase 2 mappings?
- SLA targets for ingestion latency and API availability?

---

## 10. References (code)

| Topic | Location |
| --- | --- |
| Phase 1 APIs | `src/app/api/phase1/` |
| Sufficiency engine | `src/lib/phase1/sufficiency/` |
| Insights rules | `src/lib/phase1/insights/rules.ts` |
| Readiness from events | `src/lib/phase1/computeReadinessSnapshot.ts` |
| Discovery validation | `src/lib/discovery/schema.ts` |
| README / env matrix | `forge/README.md` |

---

*End of document.*

# Forge — Product Requirements (full scope, Phases 0–4)

**Audience:** Founders, product, engineering, GTM  
**Repo:** `forge/` (Next.js App Router)  
**Status:** Living document — aligns roadmap with shipped code where noted.

This is the **canonical, version-controlled** product narrative. For private scratch notes, use a local file such as `forge/PRD.full.md` (gitignored if listed in `forge/.gitignore`).

---

## 1. Executive summary

**Forge** is a **site improver**, not a site builder: it helps teams decide **what to change on an existing live product** by grounding prioritization in **observed user behavior**, **per-property design/context**, and **attributable receipts**—not generic templates alone. Strategic differentiation, autonomy boundaries, credibility demos, and third-party-first composition are specified in `**docs/SITE_IMPROVER_VISION_PRD.md`** (read alongside this document).

The **primary product promise** is not “more analytics”—it is a **closed loop**: connect the live property and telemetry → **understand** behavior and design context → **preview** a concrete change (when applicable) → **measure impact in production** with explicit grounding. That loop must be **surfaced in product UI**; APIs and receipts alone do not operationalize the value proposition for customers.

The phased product combines:

- **Intake & discovery** (Phase 0) to validate problems and recruit design partners.
- **Deterministic analysis** (Phase 1+) — sufficiency, readiness, insights, recommendations — via HTTP APIs **and** operator-facing surfaces that make outputs actionable (see §5.1).
- **Phases 2–4:** deeper integrations, **preview and experiment orchestration**, closed loops for **production** outcomes, and multi-tenant operations — **the experiential layer is not “late-stage decoration”;** it is how teams consume Phase 1–2 engines (see §5.1 and `**docs/CUSTOMER_READINESS_BACKLOG.md` Epic I**).

Success is measured by **decision quality** (fewer bad bets), **time-to-confidence** (how fast teams know they have enough signal), **pilot traction** (sites onboarded, events flowing, outputs consumed), and **loop completion rate** (share of approved suggestions that reach a **measured** production outcome within an agreed window).

**Go-to-market stance:** prioritize a **specific ideal customer** who already exhibits urgent pull (see **§4.1**); broaden horizontally only after that beachhead repeats.

---

## 2. Problem statement

Product and growth teams routinely suffer from:

1. **Premature shipping** — changes go live without enough behavioral evidence.
2. **Opaque prioritization** — roadmaps rest on anecdotes; stakeholders cannot audit criteria.
3. **Tool sprawl** — analytics and session tools accumulate without a shared bar for “enough data” or “what to try next.”

Forge addresses this by making **sufficiency and readiness explicit**, producing **ranked, explainable outputs** suitable for reviews, docs, and sales narratives.

---

## 3. Product vision

Forge becomes the **decision layer** between telemetry and execution: ingest structured signals, judge whether conclusions are justified, surface ranked insights, and recommend next actions with explicit confidence—all on **the customer’s live site**, respecting **per-property context** (“design DNA”), not prescribing a generic Forge look. Expanded positioning—**site improver vs site builder**, **credibility demos**, **third-party composition**, autonomy levels—is in `**docs/SITE_IMPROVER_VISION_PRD.md`**.

**Experience vision:** Users connect **URL, repository, and/or analytics** (any combination that gives Forge enough signal). Forge runs **baseline collection and understanding** (sync, snapshots, rollups, audits) **while** the user completes onboarding. The product then delivers **ongoing, prioritized suggestions** with reasoning and evidence, supports **preview** of changes where feasible, and **always** provides a credible path to **measure impact in production** (experiments, flags, or linked PostHog artifacts)—presented in a **dashboard** that uses clear, creative visualization so teams can **see** status, variants, and lifts—not only read JSON.

Long-term, Forge pairs deterministic cores with richer integrations and outcome feedback. **Near-term**, the vertical slice is **not** only ingest → score → recommend → inspect; it must include **inspect → preview (where applicable) → ship/measure** as first-class UX, or the backend remains under-utilized.

---

## 3.1 Product experience principle — UI is load-bearing

Forge’s Phase 1–2 **engines** (readiness, insights, Phase 2 audit rules, receipts) already produce substantial value **in code**. Without a coherent **product surface**, customers cannot reliably:

- See **integration health**, job progress, and **why** a gate blocked “trustworthy” output.
- Move from a **finding** to an **approved change** with a defined **preview** and **production measurement** plan.
- Run an **ongoing** loop (new data → new suggestions → experiments) from a **single cockpit**.

Therefore **UX for the improver cockpit, preview, and production measurement is not sequenced as “after backends are done.”** It is developed **in parallel** with connectors and audit quality, scoped so each slice is shippable. `**docs/CUSTOMER_READINESS_BACKLOG.md` Epic I** tracks this layer explicitly.

---

## 3.2 Current capabilities vs gaps (living)


| Area                      | **Shipped / strong today**                                                                                    | **Gap for stated product promise**                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Telemetry & events**    | PostHog sync, Segment webhook, canonical events, scheduled sync path                                          | Surfacing **freshness**, failures, and “enough data yet?” in a **cockpit**, not only APIs                                                                               |
| **Analysis & evidence**   | Phase 1 readiness/recommendations; Phase 2 insights run, validation gate, audit rules, Markdown/JSON receipts | **Ranked backlog UI**, deep links to evidence, **suggestion lifecycle** (proposed → in test → shipped → measured)                                                       |
| **Design / page context** | Page snapshots, DNA-oriented audit rules                                                                      | **Progressive disclosure** in UI (what we fetched, what changed); optional richer previews (Epic F)                                                                     |
| **Git / code**            | Directional (PR drafts in backlog)                                                                            | **Connect repo**, map repo ↔ site, surface **patch / PR path** from a finding                                                                                           |
| **Preview**               | Not a first-class product object                                                                              | **Preview story**: staging URL, branch preview, screenshot/mock slot, or flag-driven variant — **minimum tier** defined in Epic I                                       |
| **Production impact**     | Hypothesis linkage story (FORGE-060); receipts cite windows                                                   | **Experiment / flag entity** in product: primary metric, audience, duration, **results vs baseline**, guardrails — **Preview → measure** must be **one navigable flow** |
| **Dashboard**             | Fragmented operator pages (`/phase1`, `/phase2`, `/onboarding` starters)                                      | **Unified improver dashboard**: connections, jobs, findings, previews, experiments, visualization                                                                       |
| **Auth / tenancy**        | Evolution toward Clerk + API keys (see customer readiness backlog)                                            | Roles, audit log, collaboration (existing epics)                                                                                                                        |


This table is updated as surfaces ship; implementation truth lives in repo + backlog IDs.

---

## 4. Personas


| Persona                     | Needs                                                                          |
| --------------------------- | ------------------------------------------------------------------------------ |
| **Operator PM / growth**    | Defensible prioritization; transparent “why we believe we have enough signal.” |
| **Engineer (integrations)** | Stable APIs, predictable validation errors, sensible dev vs prod config.       |
| **Founder / GTM**           | A credible pilot story: week-one value, proof definition, pricing experiments. |

### 4.1 Ideal customer profile (ICP) — audience-first beachhead

**Position:** Forge scales by starting **narrow**: observe **who** already strains under the status quo, confirm they **desperately** want a better loop (not “nice to have”), then **tailor** product and narrative to that cohort. The **specific solution shape** (features, receipts, integrations, UX emphasis) follows from serving that audience exceptionally well; leading only with a generic “solution to a problem” across everyone spreads focus and weakens pull.

**First beachhead (who we optimize for before horizontal expansion)**

| Dimension | ICP definition |
| --------- | -------------- |
| **Role** | Operator PM / growth lead (or product owner with growth mandate); founders wearing that hat in smaller teams. |
| **Context** | **Live** consumer- or prosumer-facing **web product** already in market; meaningful traffic and **instrumentation** (e.g. PostHog/Segment or equivalent) in place or committed during onboarding. |
| **Pain intensity** | Prioritization is **opaque or politically fragile**; roadmap debates rely on anecdotes; **conversion / activation / retention** work feels guess-prone despite paying for analytics and replay. |
| **Why Forge vs alternatives** | Needs **one ranked, attributable improvement narrative** (receipts, gates, DNA-aware audits) that respects **distinctive design**, not a generic template audit or “replace your stack” suite. |
| **Partners** | Engineering engaged for **connectors, previews, and measurement** (flags/experiments)—not as primary IC persona, but as **blocking partner** for closed-loop value. |

**Explicit non-ICP (until pull proves otherwise)**  

Teams optimizing only for **greenfield builds** with no live behavioral signal; orgs unwilling to connect **read-only telemetry**; buyers seeking **a site builder or CMS**; users who only want **more charts** without auditability or a **preview → measure** path.

**Scaling hypothesis**  

Win **repeatable urgency** in this cohort (same workflows, same objections, same receipt vocabulary), then **adjacent** personas (e.g. deeper eng-led workflows, regulated verticals with audit-heavy stakeholders) as **expansion**, not as day-one dilution of positioning.

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

**Goal:** Ship a **deterministic analysis core** and **repository-backed APIs** so real traffic can flow without rebuilding foundations — and expose outcomes through **operator UI** sufficient to act (not only curl/README).

**Product surface (required alongside APIs):**

- A path from **site + events** to **visible** readiness/recommendations (dashboard or embedded views).
- Clear display of **uncertainty** (sufficiency / gates) so users do not over-trust thin samples.

Without this, Phase 1 remains an integration burden rather than a product.

**In scope:**

- **Engines:** Sufficiency (`evaluateAllCategories`), readiness snapshot derivation from events, heuristic recommendations, insights rules over structured aggregates.
- **HTTP API:** `/api/phase1/`* — health, sites, events, readiness, recommendations, sufficiency, insights.
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

**Goal:** Close the loop from **recommendation → preview (where applicable) → shipped / flagged change → measured outcome in production**. This phase is the **experiential spine** of Forge as a site improver—not an optional add-on after “core analytics.”

**In scope (directional):**

- **Preview:** Minimum viable **preview artifact** per suggestion class—e.g. linked **staging URL**, **preview deployment**, **image/mock**, or **documented flag key**—so stakeholders can **see** the change before it touches most traffic.
- **Production measurement:** **Experiment or rollout object** with hypothesis, **primary metric**, audience/segment, planned duration, **guardrails**, and link to **customer-owned truth** (PostHog experiment, feature flag, or dashboard URL) so lift claims stay **auditable**.
- **Unified cockpit:** Single dashboard for **connections**, **running jobs**, **backlog of findings**, **active experiments**, and **history** (aligned with `**CUSTOMER_READINESS_BACKLOG.md` Epic I**).
- Operator workflows: assign owners, deadlines, **status** on findings (extends Epic G “bet status”).
- Notifications (email/Slack) for gate flips, experiment milestones, and integration failures.

**Success criteria:**

- A pilot can complete **preview → production measure** for at least one real suggestion class without leaving Forge’s guided surfaces (external tools may host the experiment, but Forge **orchestrates and displays** status and links).
- Teams can answer **“did the change move the metric, with what confidence?”** within an agreed window—and see **where** that answer lives (receipt + external dashboard).

**Non-goals:** Full project management suite; Forge replacing PostHog’s full analytics UI; guaranteed lift refunds without auditable KPIs (see vision PRD).

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

- **Production direction:** authenticated users / orgs (e.g. IdP + active org) and **machine API keys** with scopes — see `**docs/CUSTOMER_READINESS_BACKLOG.md` Epic A** and shipped patterns in-repo.
- Legacy / dev: org resolution via header, query, or body where explicitly supported for local demos (`PHASE1_ORG_IDENTITY_MODE`, defaults).

---

## 7. Metrics (north stars)


| Area            | Metric                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Activation      | Sites created + events ingested + readiness/recommendations fetched successfully                                                          |
| Loop completion | **Preview → production measure:** % of pilot suggestions that reach **measured** status with linked metric dashboard or experiment record |
| Product surface | Time-to-first **cockpit** session where user sees backlog + integration health without engineer assistance                                |
| Quality         | % of recommendations acted on in pilots (manual tracking early); **trustworthy receipt rate**                                             |
| Engineering     | Build green; smoke tests for critical APIs                                                                                                |


---

## 8. Risks & mitigations


| Risk                           | Mitigation                                                       |
| ------------------------------ | ---------------------------------------------------------------- |
| Sparse data → wrong confidence | Sufficiency thresholds; readiness states communicate uncertainty |
| Blob concurrency / growth      | Partitioned objects; Postgres for heavy workloads                |
| Tenant leakage                 | `header_required` org mode; tests for org filters                |


---

## 9. Open questions

- Pilot success definition: conversion lift vs velocity of decisions vs revenue?
- **Minimum preview tier** for v1 pilots (staging link only vs branch preview vs in-product iframe)—cost and fraud constraints?
- **Flag / deployment model:** customer feature-flag vendor vs Forge-hosted toggles vs Git-only PR flow?
- First analytics providers to prioritize for Phase 2 mappings?
- SLA targets for ingestion latency and API availability?
- How much **creative visualization** (beyond charts/tables) is required for v1 credibility vs Phase 2 polish?

---

## 10. References (documents & code)


| Topic                                                                       | Location                                     |
| --------------------------------------------------------------------------- | -------------------------------------------- |
| **Site Improver Vision & credibility demos**                                | `forge/docs/SITE_IMPROVER_VISION_PRD.md`     |
| **Customer readiness backlog (commercial epics + Epic I experience layer)** | `forge/docs/CUSTOMER_READINESS_BACKLOG.md`   |
| Evidence model / Phase 2 audits                                             | `forge/docs/PHASE2_EVIDENCE_MODEL.md`        |
| Phase 1 APIs                                                                | `src/app/api/phase1/`                        |
| Sufficiency engine                                                          | `src/lib/phase1/sufficiency/`                |
| Insights rules                                                              | `src/lib/phase1/insights/rules.ts`           |
| Readiness from events                                                       | `src/lib/phase1/computeReadinessSnapshot.ts` |
| Discovery validation                                                        | `src/lib/discovery/schema.ts`                |
| README / env matrix                                                         | `forge/README.md`                            |


---

*End of document.*
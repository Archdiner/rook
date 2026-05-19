<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Zybit — Agent Context

## What Zybit is

Zybit is a conversion intelligence platform for product managers. It runs a six-step loop: **Understand** (audit the product via page snapshots) → **Watch** (ingest real user behavioral data) → **Identify** (surface evidence-backed friction findings) → **Propose** (generate A/B prescriptions) → **Test** (deploy variants to production traffic via proxy) → **Learn** (feed outcomes back into the rule engine to improve future findings).

**Full product doctrine and build philosophy:** [`DOCTRINE.md`](./DOCTRINE.md) — read it before making any architectural decisions.

---

## Build conventions (non-negotiable)

- **Deterministic over generative.** Audit rules are pure functions — same input, same output. No LLM-generated numbers or invented evidence.
- **PM-first at every layer.** Every output (finding title, evidence summary, UI label) is for a product manager, not an engineer.
- **Every file has a purpose.** No scaffolding, no placeholders, no "we might need this later."
- **Third-party where it's better.** Email = Resend. Billing = Stripe. Headless browser = Browserless.io. Cron monitoring = Cronitor. Observability = Axiom. Do not rebuild what third parties do well. (Auth is owned: invite-only magic-link system, no Clerk.)
- **`npm run verify` must pass** before any commit: lint + TypeScript + build.

---

## Codebase map

```
zybit/
  src/lib/phase2/rules/       — 12 audit rules (5 design + 7 pain), 193 tests
  src/lib/phase2/connectors/  — PostHog (pull-sync) + Segment (webhook)
  src/lib/phase2/snapshots/   — Static HTML parse + visual-weight analysis
  src/lib/phase2/rollups/     — Event → InsightInput aggregation pipeline
  src/lib/phase1/             — Readiness scoring + legacy insights engine
  src/lib/auth/               — Invite-only magic-link auth + M2M API keys
  src/lib/billing/            — Stripe integration (plans, limits, usage metering)
  src/lib/experiments/        — Bucketing, HTML modifier, edge proxy (partial)
  src/lib/observability/      — Cronitor, error budget, structured logger
  src/lib/db/                 — Drizzle schema + Postgres client (Neon)
  src/app/api/phase1/         — Readiness + insights HTTP API
  src/app/api/phase2/         — Canonical events, insights run, connectors, snapshots
  src/app/api/dashboard/      — Findings and experiments CRUD
  src/app/api/billing/        — Stripe checkout, portal, usage, webhook
  src/app/api/proxy/          — Edge proxy assignment + config
  src/app/app/                — PM dashboard (findings, experiments, onboarding, settings)
  drizzle/                    — SQL migrations (apply before first run with Postgres)
  docs/                       — Technical reference
```

---

## Current build state

| Loop Step | Status | Notes |
|-----------|--------|-------|
| **Understand** (snapshot audit) | ⚠️ Partial | HTTP + DOM parse works; SPA/JS-rendered pages return blank — prerequisite for paid pilot |
| **Watch** (PostHog + Segment) | ✅ Built | Pull-sync + webhook; GA4 not built (next connector priority) |
| **Identify** (12 audit rules) | ✅ Built | 5 design + 7 pain rules, 193 passing tests — sufficient; do not add more rules |
| **Propose** (findings + prescriptions) | ✅ Built | Ranked by priority score + revenue impact, PM-readable |
| **Test** (variant deployment) | ⚠️ Partial | Bucketing + HTML modifier + proxy routes built; no fail-open, no kill switch, no SPA handling |
| **Measure** (outcome computation) | ❌ Not built | Results are manually entered; no chi-squared, no sequential testing, no guardrails — **highest priority gap** |
| **Learn** (outcome feedback loop) | ❌ Not built | No outcome storage, no rule calibration — depends on Measure first |
| **Visible loop view** | ❌ Not built | No timeline of detect → deploy → result → learning — needed for every demo and renewal |
| **Preview before deploy** | ❌ Not built | PM cannot see variant before it goes live — trust blocker |
| **GA4 connector** | ❌ Not built | Required for analytics-agnostic claim to be credible |
| **Billing** (Stripe + plan limits) | ⚠️ Partial | Routes and helpers exist; plan enforcement may be incomplete |
| **Observability** | ⚠️ Partial | Cronitor, error budget, logger built; Axiom drain not wired |

## Immediate build order

1. **Measure — compute-outcomes** (4 days): outcome table + conversion join + chi-squared + sequential testing guard + auto-stop + guardrail evaluation + cron. Nothing else matters until this exists.
2. **Preview before deploy** (2 days, parallel): `/api/preview/[experimentId]` + iframe in experiment detail.
3. **Visible loop view** (3 days): `/app/loop` timeline of the full cycle.
4. **Proxy reliability + SPA** (4 days): fail-open, kill switch, Browserless SPA support, auto-rollback wiring.

**Never build:** sentiment analysis, GitHub PR generation, own event collection SDK / PostHog replacement, more audit rules, cross-site priors before 50+ customers.

**For full specifications:** `docs/ARCHITECTURE.md` — "Priority Build Items" section. `docs/BACKLOG.md` — Epics J, K, L, M.

**For the gap analysis and build plan:** [`../product_gap.md`](../product_gap.md)

---

## Document map

| Document | Purpose | Update when... |
|----------|---------|----------------|
| `DOCTRINE.md` | Product vision, who it's for, build conventions, current state | Features ship, scope changes, or "Where we are today" drifts from reality |
| `docs/ARCHITECTURE.md` | Technical architecture, what's built, what's not | Features complete or new components are added |
| `docs/BACKLOG.md` | Prioritized epics and stories | Stories ship, priorities change |
| `../product_gap.md` | Gap analysis, build plan, sequencing | Gaps are closed or re-scoped |
| `README.md` | Project overview, local setup, env vars | Status changes, env vars added or removed |
| `docs/PHASE2_EVIDENCE_MODEL.md` | Canonical event schema, audit rule contracts | Event schema or rule interface changes |
| `docs/PHASE2_LIVE_TUNING_PLAYBOOK.md` | Operator runbook for rule calibration | Rule thresholds or tuning approach changes |

---

## End-of-session obligations

**After every session where you write or modify code, update the relevant documentation.** These documents are the project's source of truth — they must reflect reality, not aspirations. Do not skip this step.

### Checklist

1. **Did you ship a feature that was listed as "not built" or "partial"?**
   - Update `docs/ARCHITECTURE.md` — move it from "What Needs to Be Built" into "What Exists"
   - Update the "Current build state" table above in this file
   - Update `DOCTRINE.md` — "Where we are today" section

2. **Did you complete a backlog story?**
   - Update `docs/BACKLOG.md` — mark the story **Shipped** with a brief note

3. **Did you close or partially close a gap from the gap analysis?**
   - Update `../product_gap.md` — update the status table row for the affected gap

4. **Did you add, rename, or remove API routes, env vars, or major source directories?**
   - Update `README.md` — env var table and repository structure
   - Update `DOCTRINE.md` — codebase map
   - Update `docs/ARCHITECTURE.md` — relevant component tables

5. **Did you change the canonical event schema or an audit rule interface?**
   - Update `docs/PHASE2_EVIDENCE_MODEL.md`

6. **Did you add, remove, or substantially change an audit rule?**
   - Update the rule count in `docs/ARCHITECTURE.md`
   - Update rule counts in `DOCTRINE.md` if referenced

### How to update

- Be factual and minimal. Change only what changed.
- Do not remove historical context — revise sections to reflect current state rather than erasing prior descriptions.
- If the change is a small bug fix, a one-line status note is sufficient.
- If the change closes a major gap, update all affected documents in the checklist above.
- Include documentation changes in the same commit as the code change.

### Consistency requirement

The following must always agree with each other:

- "Current build state" table in this file (`AGENTS.md`)
- "Where we are today" section in `DOCTRINE.md`
- "What Exists" section in `docs/ARCHITECTURE.md`
- Status table at the top of `../product_gap.md`

If you notice any of these are out of sync — even if you didn't cause the drift — fix them.

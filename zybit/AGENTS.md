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
- **Third-party where it's better.** Auth = invite-only magic-link sessions in `src/lib/auth/` (Clerk was removed in `a786d37`). Email = Resend. Billing = Stripe. Headless browser = Browserless.io. Cron monitoring = Cronitor. Observability = Axiom. Do not rebuild what third parties do well.
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
| **Understand** (snapshot audit) | ⚠️ Partial | HTTP + DOM parse works; SPA/JS-rendered pages trigger Browserless fallback (`browserFetcher.ts`). snapshotMethod field on records. |
| **Watch** (PostHog + Segment + GA4) | ⚠️ Partial | PostHog + Segment built; GA4 scaffolded (`src/lib/phase2/connectors/ga4/`) — auth + sync implementation remaining |
| **Identify** (12 audit rules) | ✅ Built | 5 design + 7 pain rules, 193 passing tests — sufficient; do not add more rules |
| **Propose** (findings + prescriptions) | ✅ Built | Ranked by priority score + revenue impact, PM-readable |
| **Test** (variant deployment) | ⚠️ Partial | Bucketing + HTML modifier + proxy routes built. Network-error fail-open, modification-error fail-open, kill switch (`experiment.status === 'running'`), origin timeout (10s) all shipped in `handler.ts`. SPA shell detection logs warning. |
| **Measure** (outcome computation) | ✅ Built | OBF alpha-spending (`stats.ts`), daily cron (`vercel.json`), 362 passing tests. Simulation: 2,000 null experiments, FP-rate ≤ 6.5% (3-sigma MC tolerance). PostHog visitor-ID bridge not yet in place. |
| **Learn** (outcome feedback loop) | ❌ Not built | Outcome rows are persisted, but no rule calibration consumes them yet |
| **Visible loop view** | ⚠️ Partial | `loadTimeline()` + `loadSites()` implemented in `loop/page.tsx` — queries `zybit_findings`, `zybit_experiments`, `zybit_experiment_outcomes`; guardrail-breach visuals + multi-site selector still TODO |
| **Preview before deploy** | ✅ Built | Side-by-side control/variant iframes on experiment detail page; CSP `frame-ancestors 'self'` on preview response |
| **GA4 connector** | ⚠️ Partial | Scaffolded — `types.ts`, `client.ts`, `sync.ts`, `mapping.ts`, `errors.ts`. Service-account JWT auth + sync implementation remaining |
| **Billing** (Stripe + plan limits) | ⚠️ Partial | Routes and helpers exist (`src/lib/billing/`, `src/app/api/billing/`); plan enforcement coverage unverified |
| **Observability** | ⚠️ Partial | Cronitor + error budget + structured logger built and wired into crons; Axiom drain not yet connected |

## Immediate build order

> **Status (2026-05-19):** OBF alpha-spending (Zybit-082), proxy reliability (Zybit-100/101/102/104), preview iframe (Zybit-112), loop view (Zybit-090/091/092) all shipped on `claude/fix-measurement-proxy-reliability` branch. Remaining: GA4 auth + sync; guardrail breach notification; PostHog visitor-ID bridge; Edge Config sync write path.

1. **Close shipped-but-incomplete acceptance criteria** (~1 day): Edge Config write path for kill switch (Zybit-104); PM notification on auto-stop (Zybit-084); "last computed at" surface (Zybit-086).
2. **GA4 connector** (3 days): service-account JWT signing + `runReport` pagination + cursor management.
3. **PostHog visitor-ID bridge** (~0.5 day): inject script via proxy so `posthog.register({'zybit_vid': ...})` carries the Zybit cookie into conversion events.
4. **Guardrail visual in loop view** (~0.5 day): amber flag when `guardrail_breached` is set.
5. **Multi-site selector in loop view** (~0.5 day): site dropdown filtering timeline entries.

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

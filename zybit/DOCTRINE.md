# Zybit — Product Doctrine

**This is the single source of truth for what Zybit is, who it's for, and how we build it.**

---

## What Zybit is

Zybit is a conversion intelligence platform for product managers.

You connect your website or product. Zybit audits it — learning your brand DNA, visual hierarchy, and messaging — then watches how your real users move through it. It identifies exactly where conversions are being lost, proposes specific evidence-backed changes, and deploys live A/B tests against your production site. You see what worked. The cycle repeats. Your product gets measurably better.

---

## Who it's for

**Primary buyer:** Product managers and Chief Product Officers at B2B SaaS companies, startups, and consumer products where conversion rate directly moves revenue.

**Primary user:** The PM who owns growth. Someone who knows their product needs work but can't justify which change to prioritize — and doesn't want to spend weeks inside analytics dashboards to find out.

**Not for:** Developers (they integrate Zybit; PMs use it). Teams that want more charts. People building sites from scratch.

The PM-first framing is non-negotiable. Every UI decision, every output format, every finding must be evaluated by: *would a product manager understand this and know what to do next?*

---

## The loop

Zybit runs a repeating six-step cycle. The loop is the product — every feature we build either advances the loop or it doesn't belong.

### 1. Understand
Full-site audit via headless browser. Zybit reads your brand DNA: visual hierarchy, heading structure, CTA inventory, form complexity, messaging. It doesn't impose a template — it learns what makes your site yours, so it can identify deviations from your own intent, not from some generic rulebook.

### 2. Watch
Behavioral data collection from your analytics stack (PostHog, Segment, or direct). Zybit tracks how real users move: where they hesitate, where they abandon, which cohorts convert differently, what gets rage-clicked.

### 3. Identify
Chokepoint analysis. Zybit surfaces specific, evidence-grounded findings — naming the actual element, the actual form field, the actual page, the actual user segment where friction lives. Every finding is traceable to the underlying behavioral data. We do not surface suggestions with no evidence.

### 4. Propose
Concrete improvement briefs. Each suggestion includes: what to change, why it works (citing specific behavioral evidence), and exactly what the A/B variant should look like. The PM reviews and approves.

### 5. Test
One-click A/B deployment to production. PM approves the variant; Zybit manages the test. No engineering ticket required. The change goes live against real traffic.

### 6. Learn
Test outcomes — what moved the metric, what didn't — feed back into the model. Every result makes future suggestions sharper. This is what compounds over time, and it is currently the most underbuilt part of the product.

---

## Unique value

**Evidence-first.** Every finding is traceable to specific behavioral data. If we can't cite the evidence, we don't make the suggestion.

**Brand-aware.** Zybit understands your site before it criticizes it. Per-site normalization means we compare you to yourself, not to a generic template. A finding that would harm what makes your product distinctive is a bad finding.

**Closed-loop measurement.** Not just "here's what to change" but "here's what we tested and what we learned." The value compounds as results feed into better future suggestions.

**One ranked backlog.** Instead of scattered analytics tabs, replay sessions, and team gut-feel, PMs get one prioritized, evidence-backed list of improvements — with receipts attached.

---

## The long-term vision

**Close the loop entirely.** Today Zybit tells you what to change and runs the test. The next step is learning from every test result automatically, across every customer — so each round of suggestions is measurably better than the last.

**Simulate before shipping.** Once we have enough data on how humans interact with websites at scale, we can simulate A/B test outcomes before running them live. Ship the winning variant on day one, with model-backed confidence.

The endgame: your product improves continuously, without you thinking about it. Product managers and CPOs would pay significant money for a product that genuinely does this. Nobody has fully built it yet.

---

## What Zybit is not

- A site builder or CMS
- A replacement for your analytics stack (PostHog, Segment, GA4)
- A "UX best practices" checklist
- An AI that writes copy or redesigns your pages
- A tool that invents numbers or generates evidence from thin air

---

## Where we are today

The analysis engine is complete. Zybit can:

- Audit any website's visual hierarchy via static page snapshots
- Ingest behavioral data from PostHog and Segment
- Run 12 deterministic audit rules (5 design + 7 pain) across combined behavioral and design signals
- Surface specific findings with A/B prescriptions and revenue impact estimates
- Export audit receipts in JSON (`zybit.receipt.v1`) and Markdown

**What's not yet complete:**

- PM-facing dashboard: findings → approve → deploy as a live A/B test
- One-click A/B deployment to production
- Outcome tracking that closes the learning loop
- Billing and commercial layer

The engine is ready. The immediate priority is the product surface that makes it usable for a PM without touching the API.

---

## How we build

**Deterministic over generative.** Audit rules are pure functions. Same input, same output. Every finding is reproducible and attributable. We do not use LLMs to generate numbers or invent evidence.

**Every file has a purpose.** No scaffolding, no placeholders, no "we might need this later." If code doesn't serve a current need, it doesn't exist.

**The loop, not the feature.** We don't build analytics features or dashboard charts for their own sake. We build what advances the cycle: understand → propose → test → learn.

**Third-party where it's better.** We own the conversion intelligence layer. We don't own auth (Clerk), email (Resend), analytics ingestion (PostHog/Segment), or hosting (Vercel). Integrate the rest; build only what's differentiated.

**PM-first at every layer.** The PM is the user. Engineering integrates Zybit; PMs run it. Every output — finding title, evidence summary, export format — is written for someone who owns a product, not someone who reads curl responses.

---

## Codebase map

```
zybit/
  src/lib/phase1/         — Readiness scoring + insights engine (deterministic, pure)
  src/lib/phase2/         — Canonical events, audit rules, connectors, snapshots
    connectors/posthog/   — PostHog sync + event mapping
    connectors/segment/   — Segment webhook receiver
    rules/                — 12 audit rules (design + pain) with 193 tests
    snapshots/            — Static HTML parse + visual-weight analysis
    rollups/              — Event → InsightInput aggregation pipeline
  src/lib/auth/           — Clerk auth + M2M API keys
  src/lib/db/             — Drizzle schema + Postgres migrations
  src/app/api/phase1/     — Readiness + insights HTTP API
  src/app/api/phase2/     — Canonical events, insights run, connectors, snapshots
  src/app/dashboard/      — Customer-facing PM dashboard (in progress)
  drizzle/                — SQL migrations
  docs/                   — Technical reference
```

## Document map

| Document | Purpose |
|----------|---------|
| `DOCTRINE.md` (this file) | What Zybit is, who it's for, how we build it |
| `docs/ARCHITECTURE.md` | Technical architecture: system design, what's built, what's not, scaling |
| `docs/BACKLOG.md` | Prioritized epics and stories toward commercial launch |
| `docs/PHASE2_EVIDENCE_MODEL.md` | Technical reference: event schema, audit rules, connector contracts |
| `docs/PHASE2_LIVE_TUNING_PLAYBOOK.md` | Operator runbook for calibrating rules against live traffic |

# Zybit — Technical Architecture

How the system works, what each component does, what needs to be built, and how it scales. This is the engineering companion to [DOCTRINE.md](../DOCTRINE.md).

---

## System Overview

Zybit is a single Next.js application deployed on Vercel. All domain logic runs server-side in API routes and library modules. The frontend is a PM-facing dashboard. There is no separate backend service.

```
┌─────────────────────────────────────────────────────────┐
│                     Zybit (Next.js)                      │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Dashboard │  │ API      │  │ Cron     │  │ Auth   │  │
│  │ (React)  │  │ Routes   │  │ Jobs     │  │ (Clerk)│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┘  │
│       │              │              │                    │
│  ┌────┴──────────────┴──────────────┴──────────────┐    │
│  │              Domain Logic (src/lib)              │    │
│  │                                                  │    │
│  │  ┌───────────┐  ┌────────────┐  ┌────────────┐  │    │
│  │  │ Snapshots │  │ Connectors │  │ Audit      │  │    │
│  │  │ (Understand)│ │ (Watch)    │  │ Rules      │  │    │
│  │  │           │  │            │  │ (Identify) │  │    │
│  │  └───────────┘  └────────────┘  └────────────┘  │    │
│  │                                                  │    │
│  │  ┌───────────┐  ┌────────────┐  ┌────────────┐  │    │
│  │  │ Variant   │  │ Experiment │  │ Outcome    │  │    │
│  │  │ Engine    │  │ Deployer   │  │ Tracker    │  │    │
│  │  │ (Propose) │  │ (Test)     │  │ (Learn)    │  │    │
│  │  │ NOT BUILT │  │ NOT BUILT  │  │ NOT BUILT  │  │    │
│  │  └───────────┘  └────────────┘  └────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
│                          │                               │
│                    ┌─────┴─────┐                         │
│                    │ Postgres  │                         │
│                    │ (Neon)    │                         │
│                    └───────────┘                         │
└─────────────────────────────────────────────────────────┘
         │                    │                  │
    ┌────┴────┐         ┌────┴────┐        ┌────┴────┐
    │ PostHog │         │ Segment │        │Customer │
    │ API     │         │ Webhook │        │  Site   │
    └─────────┘         └─────────┘        └─────────┘
```

---

## What Exists (built, tested, working)

### Understand — Page Audit (`src/lib/phase2/snapshots/`)

Static HTML analysis. Fetches pages via HTTP, parses DOM structure.

| Component | File | What it does |
|-----------|------|--------------|
| Fetcher | `fetcher.ts` | HTTP GET with redirect following, robots.txt respect, 5s timeout, 1.5MB limit |
| Parser | `parser.ts` | Extracts headings, CTAs (buttons + links), forms, meta tags, landmarks |
| Visual weight | `visualWeight.ts` | Scores element prominence from Tailwind class tokens (text-2xl, bg-primary, font-bold) |
| Fold guess | `foldGuess.ts` | Estimates above/below fold from DOM position + landmark proximity |

**Limitation:** No JavaScript execution. SPAs render blank. Visual weight is heuristic (class token matching), not measured pixel positions. This is the right tradeoff for now — headless browser adds cost and complexity. Upgrade path is clear (Browserless/Playwright behind feature flag).

### Watch — Data Collection (`src/lib/phase2/connectors/`)

Event ingestion from customer analytics tools.

| Connector | Method | Status |
|-----------|--------|--------|
| PostHog | API pull (paginated, cursor-tracked, retry/backoff) | Working |
| Segment | Webhook receiver | Working |
| GA4 | — | Not built |
| Direct JS SDK | — | Not built |

Events are normalized to a canonical schema (`CanonicalEvent v2`) with deduplication on `(siteId, source, sourceEventId)`.

### Identify — Audit Rules (`src/lib/phase2/rules/`)

12 deterministic rules. Pure functions. Same input → same output.

**Design rules (5):** hero-hierarchy-inversion, above-fold-coverage, rage-click-target, mobile-engagement-asymmetry, nav-dispersion

**Pain rules (7):** form-abandonment, help-seeking-spike, hesitation-pattern, bounce-on-key-page, error-exposure, return-visit-thrash, cohort-pain-asymmetry

Each finding includes: severity, confidence, priority score, structured evidence array, text prescription (what to change, why, variant description), and revenue impact estimate.

### Dashboard (`src/app/dashboard/`)

PM-facing product surface. Connected to real APIs and real data.

| Page | What it does |
|------|--------------|
| Cockpit | Top 3 findings, integration health, active experiments, data readiness |
| Findings list | Ranked backlog with status filters (open/approved/dismissed/shipped/measured) |
| Finding detail | Evidence table, prescription, preview slot, approve/dismiss/measure buttons |
| Experiments list | All experiments with confidence bars and lift percentages |
| Experiment detail | Hypothesis, control vs variant rates, confidence meter, result entry |
| Connect | Guided setup wizard (site URL → PostHog → Segment → GitHub) |

### Storage

Single Postgres database (Neon serverless) via Drizzle ORM.

| Table | Purpose |
|-------|---------|
| `phase1_sites` | Site registrations |
| `phase1_events` | Canonical events (Phase 1 + 2 unified) |
| `phase2_site_configs` | Per-site cohort/onboarding/CTA/narrative config |
| `phase2_integrations` | Connector records (PostHog/Segment, status, cursor) |
| `phase2_page_snapshots` | Page DNA snapshots |
| `zybit_findings` | Persisted audit findings with lifecycle |
| `zybit_experiments` | Experiment metadata and results |
| `zybit_site_meta` | Site operational metadata (MRR, AOV, session counts) |
| `zybit_api_keys` | M2M API keys (hashed) |

### Auth

Clerk for user auth. M2M API keys for programmatic access. Tenant scoping on `(organizationId, siteId)`.

---

## What Needs to Be Built

### Step 5: Test — Experiment Deployment

This is the hardest engineering problem in the product. Zybit needs to modify a customer's live website without owning their infrastructure. Three viable approaches, ordered by feasibility:

#### Option A: Proxy-based variant injection (recommended first)

Zybit acts as a reverse proxy for the customer's site. Traffic routes through Zybit, which injects variant modifications on the fly.

```
User → Zybit Edge (Vercel Middleware) → Customer Origin
                    │
                    ├─ Control: pass through unmodified
                    └─ Variant: inject CSS/JS/HTML modifications
```

**How it works:**
1. Customer points a subdomain (e.g., `test.acme.com`) at Zybit via CNAME, or adds Zybit as a Vercel middleware layer
2. Zybit middleware reads the experiment config, assigns the visitor to control or variant (cookie-based bucketing)
3. For variant visitors: rewrites the response HTML to apply the change (CSS injection, element text replacement, element visibility toggle)
4. Zybit logs the assignment event back to the canonical event stream

**Variant definition format:**
```typescript
interface VariantModification {
  type: 'css-inject' | 'text-replace' | 'element-hide' | 'element-reorder' | 'attribute-set';
  selector: string;        // CSS selector targeting the element
  value: string;           // New text, CSS rules, or attribute value
}

interface ExperimentConfig {
  id: string;
  siteId: string;
  status: 'draft' | 'running' | 'completed' | 'stopped';
  trafficSplit: number;    // 0..1 — fraction assigned to variant
  modifications: VariantModification[];
  primaryMetric: string;   // Event type to measure
  durationDays: number;
  startedAt: string;
}
```

**Why this approach:**
- Works without customer code changes (just DNS)
- Supports the most common CRO modifications (button text, CTA position, form field visibility, color changes)
- Vercel Middleware runs at the edge — low latency
- Zybit already runs on Vercel, so middleware is native

**Limitations:**
- Can't modify server-side logic (pricing, API responses)
- DOM manipulation via selector is fragile if customer changes their markup
- Customer must trust Zybit as a proxy

**Implementation scope:**
- `src/lib/experiments/variantEngine.ts` — Applies modifications to HTML response
- `src/lib/experiments/bucketing.ts` — Cookie-based visitor assignment (deterministic hash)
- `middleware.ts` update — Route proxied traffic through variant engine
- Experiment config API — CRUD for `ExperimentConfig` with `modifications[]`
- Dashboard UI — Visual modification builder (select element → choose action → preview)

#### Option B: Script tag injection (lighter, less capable)

Customer adds a `<script src="https://zybit.app/sdk.js?site=xxx">` tag. The SDK reads active experiments from Zybit API and applies DOM modifications client-side.

**Pros:** No DNS changes. Customer just adds one tag.
**Cons:** Flash of original content before modification. Blocked by CSP on some sites. Client-side only.

#### Option C: Feature flag integration (delegate deployment)

Zybit creates feature flags in the customer's existing tool (PostHog Feature Flags, LaunchDarkly) via API. Customer's own code reads the flag and renders the variant.

**Pros:** Customer keeps full control. No proxy.
**Cons:** Requires customer to write variant code. Not "one-click." Breaks the PM-first promise.

**Recommendation:** Start with Option A (proxy) for maximum PM value. Fall back to Option C for customers who won't proxy.

---

### Step 6: Learn — Outcome Feedback Loop

This is the compounding advantage. Without it, Zybit is a one-shot auditor. With it, Zybit gets smarter every cycle.

#### Phase 1: Per-site outcome memory

When an experiment completes, store the outcome alongside the finding that generated it.

```typescript
interface ExperimentOutcome {
  findingId: string;
  ruleId: string;           // Which audit rule generated the finding
  siteId: string;
  pathRef: string;          // Which page
  modification: VariantModification[];
  result: 'positive' | 'negative' | 'inconclusive';
  lift: number;             // -1..+inf — measured lift
  confidence: number;       // Statistical confidence
  primaryMetric: string;
  completedAt: string;
}
```

**New table:** `zybit_experiment_outcomes` — one row per completed experiment with structured result.

**Rule integration:** Add `previousOutcomes: ExperimentOutcome[]` to `AuditRuleContext`. Rules can:
- **Boost confidence** on findings similar to past wins (same rule + same page pattern)
- **Suppress** findings similar to past losses (same rule fired, experiment showed no lift)
- **Adjust thresholds** per site (if form-abandonment experiments consistently win on this site at 70% threshold instead of 85%, lower the threshold for this site)

**Implementation scope:**
- `src/lib/phase2/rules/types.ts` — Add `previousOutcomes` to `AuditRuleContext`
- `src/lib/experiments/outcomes.ts` — Query outcomes for site, pass to rule context
- Update 3-4 rules to branch on outcomes (start with form-abandonment, bounce-on-key-page, hero-hierarchy-inversion)
- New migration: `zybit_experiment_outcomes` table

#### Phase 2: Cross-site learning (later)

Aggregate outcomes across all customers (anonymized). Build a global prior: "form-abandonment findings on signup pages have a 73% win rate across all Zybit customers." This prior informs confidence scoring for new customers before they have their own outcome history.

This is the moat. Nobody else has this data.

---

### Headless Browser Upgrade (Understand step)

Replace HTTP fetch with headless browser for JS-heavy sites.

**Approach:** Browserless.io (managed Playwright) or self-hosted Playwright behind a feature flag.

```typescript
// src/lib/phase2/snapshots/fetcher.ts
async function fetchPage(url: string, options: FetchOptions): Promise<FetchResult> {
  if (options.renderJs) {
    return fetchWithBrowser(url, options);  // Playwright via Browserless
  }
  return fetchWithHttp(url, options);       // Current implementation
}
```

**What headless adds:**
- JS-rendered content (React, Vue, Angular SPAs)
- Actual computed CSS (real colors, font sizes, element positions)
- Accurate fold position (viewport-based, not heuristic)
- Screenshot capture for visual diffs

**Cost:** ~$0.01-0.05 per page render. Cap at top 50 paths per site by traffic volume.

**Sequencing:** Not urgent. Static HTML covers most marketing sites. Add when SPA customers appear.

---

## Data Flow (end-to-end with all steps built)

```
Customer Site ──→ PostHog/Segment ──→ Zybit Connectors ──→ Canonical Events
                                                              │
Customer Site ──→ Zybit Snapshot Fetcher ──→ Page DNA          │
                                              │                │
                                              ▼                ▼
                                     ┌─────────────────────────────┐
                                     │    Audit Rule Pipeline       │
                                     │                             │
                                     │  Events + Snapshots         │
                                     │  + Site Config              │
                                     │  + Past Outcomes (Learn)    │
                                     │         │                   │
                                     │         ▼                   │
                                     │  12 Rules → Findings        │
                                     │  + Prescriptions            │
                                     │  + Impact Estimates         │
                                     └──────────┬──────────────────┘
                                                │
                                                ▼
                                     ┌──────────────────┐
                                     │  PM Dashboard     │
                                     │                  │
                                     │  Review finding  │
                                     │  Approve variant │
                                     │  Preview change  │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │ Experiment Engine │
                                     │                  │
                                     │ Deploy variant   │
                                     │ Split traffic    │
                                     │ Measure lift     │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │ Outcome Store     │
                                     │                  │
                                     │ Feed back to     │
                                     │ rule pipeline    │──→ (back to top)
                                     └──────────────────┘
```

---

## Scaling Considerations

### Event volume

Current: events held in memory for rule evaluation. ~50MB at 100k events.

| Volume | Approach |
|--------|----------|
| <100k events/site | Current in-memory approach works |
| 100k-500k | Pre-group sessions once on context (not per-rule). Enforce max-events limit on API. |
| 500k+ | Pre-aggregate into daily rollups. Rules consume rollups, not raw events. The rollup layer already exists (`src/lib/phase2/rollups/`). |

### Concurrent sites

Each site's audit runs independently. No shared state between sites. Parallelizable via Vercel Functions (each `/insights/run` call is a separate function invocation).

### Experiment traffic

Proxy-based variant injection runs in Vercel Middleware (edge). Stateless — reads experiment config from edge cache (Vercel Edge Config or KV), applies modifications, returns. No per-request database hit for experiment assignment.

### Database

Neon serverless scales reads automatically. Write-heavy paths (event ingestion) use batch inserts with `ON CONFLICT DO NOTHING` for deduplication. Indexes are already in place on all query paths.

---

## Build Sequence

What to build, in what order, to reach a launchable product.

### Phase A: Ship the analysis product (weeks, not months)

The analysis engine is done. The PM dashboard exists. What's missing is polish and the connection between "finding" and "action."

1. Close stale PRs, merge current branch to main
2. Billing (Stripe) — gate access behind subscription
3. Onboarding flow hardening (URL → PostHog connect → first audit)
4. Finding prescription quality pass (tighten prose, add concrete examples)

This gets Zybit to "paid conversion audit" — customers pay to see what's wrong.

### Phase B: Experiment deployment (the hard part)

Build Option A (proxy-based variant injection).

1. Variant definition format (`VariantModification` schema)
2. Visitor bucketing (cookie-based, deterministic hash)
3. HTML response rewriting (CSS injection, text replacement, element visibility)
4. Vercel Middleware integration for proxied traffic
5. Dashboard UI for building modifications visually (element picker + action selector)
6. Experiment lifecycle (start → monitor → stop → record outcome)

This gets Zybit to "one-click A/B testing" — the core product promise.

### Phase C: Learning loop

1. Outcome storage (structured experiment results)
2. Outcome query in rule pipeline (`previousOutcomes` on context)
3. Update 3-4 rules to use outcomes (confidence boost, threshold adjustment)
4. Per-site learning (lower/raise rule thresholds based on this site's history)

This gets Zybit to "gets smarter over time" — the compounding advantage.

### Phase D: Scale and automate

1. Cross-site outcome aggregation (global priors)
2. Headless browser integration (SPA support)
3. Auto-suggest next experiment based on outcome patterns
4. Closed-loop automation (audit → propose → deploy → measure → re-audit without PM intervention)

This gets Zybit to "your site improves while you sleep" — the endgame.

---

## Current Codebase Health

After cleanup (this session):

- **16,240 lines** of domain logic across 79 source files
- **193 tests**, all passing
- **Single storage backend** (Postgres via Drizzle — blob driver removed)
- **Zero dead code** (backend shell, duplicate onboarding page, blob repository all deleted)
- **Clean type system** (TypeScript strict mode, no `any` leaks in domain code)

The foundation is solid. The architecture is modular — new rules, new connectors, new experiment types can be added without touching existing code. The immediate work is building the experiment deployment layer (Phase B above), which is the product's core differentiator.

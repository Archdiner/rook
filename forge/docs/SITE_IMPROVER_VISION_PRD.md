# Forge — Site Improver Vision PRD

**Status:** Canonical supplement to [`PRODUCT_PRD.md`](PRODUCT_PRD.md) — **read together**.  
**Audience:** Founders, design, engineering, GTM, design partners  
**Last updated:** April 2026

---

## 1. One-sentence vision

**Forge is a site improver, not a site builder:** teams give us access to a **live property** and behavioral truth; we **infer and respect each product’s design DNA**, fuse it with **telemetry and session evidence**, and ship **ranked, attributable improvements** that **objectively reduce friction** while **strengthening—not erasing—distinctive creative intent.**

---

## 2. Non-negotiable positioning

| Forge **is** | Forge **is not** |
|--------------|------------------|
| Evidence-backed improvement layer on what you already shipped | A CMS, page builder, theme marketplace, or “make me a new site” generator |
| Composer of **best-in-class third-party** analytics, replay, email, git, and AI where appropriate | A replacement for PostHog, Segment, GitHub, Vercel, or your design system |
| A **credibility-first** product — every strong claim ships with **receipts** | A black box that asserts “best practice” without traceable proof |
| Opinionated about **user pain and outcomes**, flexible about **aesthetic voice** | A homogenizer that forces one “correct” layout or brand look |

**Tagline (internal):** *Ground truth. Your DNA. Measurable lift.*

---

## 3. Problems we solve

1. **Conversion / activation / retention work is guess-prone** — teams run A/B anecdotes, generic checklists, or AI refactors without a shared evidentiary bar.

2. **“Best practice” flattens creative brands** — one-size audits ignore typography, asymmetric layouts, and narrative tone that *are* the product—yet real problems (confusion, hidden CTAs, error clusters) hide inside distinctive shells.

3. **Tool sprawl without synthesis** — PostHog, Segment, replays, and static analysis live in separate tabs; nobody produces a **single, defensible prioritized improvement list** tied to receipts.

Forge **synthesizes** third-party streams into **one improvement narrative** grounded in DNA + data + explicit uncertainty.

---

## 3.1 Experiential spine — preview and production measurement

Receipts, rules, and connectors are necessary but not sufficient: customers experience Forge through **guided surfaces** that connect **what we observed** → **what we suggest** → **how you preview it** (when applicable) → **how we measure impact in production**. If this path is not **designed and shipped as product UX**, the backend cannot deliver its full value—there is no “early backend / late UI” split; **the loop is the product**. Operational detail and backlog IDs live in **`PRODUCT_PRD.md`** (§3.1–3.2, Phase 3) and **`CUSTOMER_READINESS_BACKLOG.md` Epic I**.

---

## 4. Design DNA — operational definition

**Design DNA** (in Forge terms) is the **structured, per-site fingerprint** of how this product presents itself—not a judgement of taste, but a **basis for deltas**:

| Dimension | Examples of signals | Primary sources (prefer 3rd party / standards) |
|-----------|---------------------|------------------------------------------------|
| **Content & hierarchy** | H1/H2 ladders, landmark usage, dominant paths | Static HTML snapshots; crawl; optional rendered capture |
| **Visual weight cues** | Class tokens (e.g. utility CSS), prominence heuristics | Snapshots + mapping from analytics DOM metadata where available |
| **Interaction vocabulary** | CTA wording patterns, nav depth, form complexity | Snapshot forms + autocapture/path events |
| **Motion / density** *(future)* | Transition heaviness scroll jank proxies | Performance vendors or RUM; session tags |
| **Brand intent** *(future, optional)* | User-declared “voice” sliders or imported tokens — **neverForge defaults** | Customer-provided YAML + extracted tokens |

**Important:** DNA is **per branch** — we compare Forge outputs to **this site’s baseline and trajectory**, not to a Forge house style.

---

## 5. How users give us “their site”

We **do not** require teams to recreate their product in Forge. Minimum viable contract:

| Input | Purpose | Typical implementation |
|-------|---------|------------------------|
| **Canonical URL(s)** (+ optional path list) | Ground design rules and audits | Already: page snapshot pipeline; roadmap: SPA rendering via third-party browser grid |
| **Read-only telemetry** | Objective behavior truth | Already: PostHog connector; Segment webhook; future: GA4 BigQuery reader, Shopify |
| **`x-org-id` + tenant scoping** | Safe multi-team storage | Existing repository pattern |
| **Optional declarative intent** (`Phase2SiteConfig`) | Narratives, cohort splits, onboarding steps — *their* funnel language | Ships today; evolves with UI |

Optional accelerators (**not MVP blockers**, but credibility boosters):

- **Git repo read access** → PR suggestions as patches (third-party Git host APIs), not Forge-hosted code hosting.
- **Design tokens / theme package** uploaded or linked → informs “creative enlargement” constraints.

---

## 6. What “autonomous understanding” means (and doesn’t)

| Level | Forge behavior |
|-------|------------------|
| **L1 Deterministic rules** *(shipping)* | Pure functions over snapshots + rollup + gated stats — repeatable, comparable, auditor-friendly receipts. |
| **L2 Enriched mapping** *(shipping / evolving)* | Provider-specific extraction (elements chain, exceptions, rage targets) feeding audit findings. |
| **L3 Generative wording** *(strictly bounded)* | Optional LLM narration **only atop** structured findings + citations — template-first default; prompts versioned; no invention of numbers. |
| **L4 Autonomous coding** *(vision, guarded)* | Generated diffs (e.g.. GitHub PR) only after **explicit** human approval policy; never silent production deploy — **credibility-critical**. |

Honesty clause: Until L4 is mature, Forge markets **prioritized proposals + receipts**, optionally formatted as Markdown/PR drafts—not unsupervised rewriting production without review.

---

## 7. Third-party–first architecture

**Principle:** *Buy or integrate; implement only Forge’s differentiated core.*

| Concern | Preferred pattern |
|---------|-------------------|
| **Product analytics ingestion** | PostHog API, Segment delivery, replay providers | Avoid bespoke pixel unless necessary |
| **Session replay excerpts** | PostHog (or RRWeb-compatible) clip links in findings | Receipts—not storing full tapes in Forge blobs by default |
| **Email / notifications** | Resend | Already Phase 0 |
| **Hosting / previews** | Vercel previews, GitHub deployments | Credibility demos on customer preview URLs |
| **Browser automation for SPA DNA** *(roadmap)* | Managed Playwright/Browserless-style services or CI-permitted workers | Operational cost explicit in pricing |
| **AI assistance** *(optional overlays)* | Vercel AI Gateway / provider routers with zero-retention config where possible | Structured outputs tied to deterministic findings only |

Forge owns: **canonical event model**, **rollup + gate**, **audit rules**, **DNA snapshot contracts**, **org-scoped storage**, **API surface**.

---

## 8. Credibility demos — programmatic requirements

Credibility demos are **not** slideware—they are **reproducible artifacts** bundled with Forge.

### 8.1 Demo artifact types

| Artifact | Contents | Produced by |
|---------|----------|-------------|
| **Receipt packet (JSON export)** | `window`, rollup diagnostics, gate warnings, audit findings + evidence rows, snapshot hashes | `insights/run` + export route *(roadmap explicit export)* |
| **Receipt deck (Markdown / PDF)** | Human-readable: finding → evidence → screenshot/snapshot excerpt → replay link placeholder | Renderer over same JSON |
| **One-page methodology** | How scores and gates work; deterministic rule IDs listed | Docs site / `docs/` |
| **Sandbox project** | Public read-only integration + sanitized events | Separate hosted demo tenant |
| **Side-by-side** | Snapshot thumbnail + heat/rage/session stats for path | Audit UI roadmap |

### 8.2 Demo script checklist (sales + design partners)

1. Show **time window & sample counts** upfront.  
2. Show **gate**: trustworthy or not—and **why**.  
3. Drill into **top finding**: evidence rows, refs to snapshot CTA hashes.  
4. Paste **replay link** or rage cluster id *(when provider supplies)*.  
5. Show **skipped diagnostics** (“rule did not fire: NO_SCROLL_DATA”).  
6. Close with **one safe experiment hypothesis** wired to measurable event.

---

## 9. Objectivity × creative freedom — resolution framework

Forge avoids **flattening individuality** via:

1. **Per-site normalization** — medians/rates keyed to *this property’s cohorts and history*, not global “SaaS template.”  
2. **Pain-first rules** — fire on abandonment, errors, hesitation, thrash—not “your font isn’t Inter.”  
3. **Creative expansion lanes** *(roadmap articulation)* — suggestions framed as **variants that preserve dominant tokens**, e.g. “keep asymmetric hero; fix scroll affordance obscuring secondary CTA.”  
4. **Explicit non-goals in findings** — “We’re not prescribing brand color.”

Violations surface when **behavior proves harm**, not when Forge dislikes novelty.

---

## 10. Roadmap (vision-aligned overlay on phases)

Aligned with [`PRODUCT_PRD.md`](PRODUCT_PRD.md) — **does not replace** phased delivery; reframes milestones.

### Phase A — Credibility nucleus *(now → near term)*

- Harden **`POST /insights/run`** demos + **`/phase2` UI** readability.  
- Exportable **audit packet**.  
- **Documented gates** (“when not to trust us”).  
- **Public methodology one-pager** + versioned **`PHASE2_EVIDENCE_MODEL`**.

### Phase B — DNA depth for real sites *(medium term)*

- **Rendered capture** pipeline (third-party automation) behind feature flag — unlock modern SPAs.  
- Expand provider mappings (replay clip ids, richer device context).

### Phase C — Guided improvement loops *(later Phase 3+)*

- Link finding → hypothesis → tracked metric slice (PostHog insight id or funnel export).  
- Optional **patch export** (`git`-style unified diff suggestion) originating from deterministic finding scope—**human merges**.

### Phase D — Operational scale *(Phase 4)*

- SLA, quotas, SSO as needed for segment.

---

## 11. Success metrics (beyond Phase 1 table)

| Signal | Measures |
|--------|----------|
| **Receipt completeness score** *(internal)* | % findings with snapshot / event / replay triad populated when data exists |
| **Pilot uplift** | Agreed KPI delta in precommitted window (**third-party verified** dashboards acceptable) |
| **Trust surrogate** | “Would ship if trusted” → qualitative exit interviews post-demo |
| **Creative divergence index** *(future heuristic)* | Cosine drift between before/after *token vectors* constrained + user satisfaction—“didn’t feel generic” qualitative |

---

## 12. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| **Homogenizing outputs** | Per-site normalization; branding intent files; forbid style scoring without behavior |
| **Over-promising autonomy** | Phased autonomy levels; approvals for code |
| **Third-party breakage** | Contract tests on connector mocks; degraded mode banners |
| **SPA snapshot gaps** until render tier | Transparent capability matrix in demos |

---

## 13. Explicit non-goals (vision PRD edition)

- Building or hosting canonical **websites**.  
- Owning ecommerce catalog, CRM, billing.  
- **Replacing designers** — we arm them with evidence.  
- **Guaranteed lift** unsupported by jointly agreed instrumentation + pre-registered hypotheses (refund policies tie to contracted measurement).

---

## 14. Document map

| Artifact | Role |
|---------|------|
| [`PRODUCT_PRD.md`](PRODUCT_PRD.md) | Phased roadmap, storage, Phase 1–4 scope |
| [`CUSTOMER_READINESS_BACKLOG.md`](CUSTOMER_READINESS_BACKLOG.md) | Commercial epics, FORGE-* stories, phased execution order |
| **`PHASE2_LIVE_TUNING_PLAYBOOK.md`** *(if present)* | Operator calibration loops |
| This document (**Site Improver Vision PRD**) | North-star differentiation, demos, autonomy boundaries |

---

## 15. Open decisions (prioritized)

1. Which **replay provider IDs** earn “first-class receipts” vs links only?  
2. **SPA render** — build vs Browserless vendor — cost envelope for pilot tier?  
3. **Codified brand intent**: optional YAML schema vs scraped tokens only?  
4. **Refund / lift guarantee**: legal linkage to externally verifiable dashboards only.

---

*End of Site Improver Vision PRD. Forge remains committed to evidenced improvement—not generic websites.*

---
name: Forge product doctrine
description: What Forge is, who it's for, and the core loop — canonical vision for all product decisions
type: project
---

Forge is a **conversion intelligence platform for product managers** (PMs and CPOs), not a developer tool.

**The 6-step loop (the product):**
1. Understand — headless browser audit of brand DNA (colors, fonts, visual hierarchy, messaging)
2. Watch — behavioral data from PostHog/Segment (hesitation, abandonment, rage clicks, cohort splits)
3. Identify — specific evidence-backed chokepoints, not generic best practices
4. Propose — concrete change briefs: what to change, why it works, what the A/B variant looks like
5. Test — PM approves, Forge deploys live A/B test to production (no engineering ticket)
6. Learn — test outcomes feed back into the model, making future suggestions sharper

**Long-term vision:** Close the loop fully (auto-suggest improvements); eventually simulate A/B test outcomes from training data before running them live.

**Who it's for:** B2B — PMs and CPOs. Not developers (they integrate it). Not teams wanting more charts.

**Current state:** Analysis engine complete (12 audit rules, PostHog + Segment, receipt exports). PM dashboard and A/B deployment not yet built — this is the immediate next priority.

**Key docs:** `forge/DOCTRINE.md` (canonical), `forge/docs/BACKLOG.md` (FORGE-xxx epics)

**Why:** Previously the codebase was fragmented — API-first developer tooling with no clear product identity. User requested a doctrine cleanup to establish this direction before continuing to build.

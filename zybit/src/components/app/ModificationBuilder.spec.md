# ModificationBuilder — UX Contract (PR 4)

> Write this component ONCE. Get it right the first time.
> Do not build until this contract has been validated.

---

## What this builds

A PM clicks "Create experiment" on an approved finding and gets a structured experiment brief they can hand to their developer or paste into their A/B testing platform.

This is **not** an executed code change. It is a **precise human-readable brief** that captures intent. Phase 6 (VariantPatch) is where selectors become executable patches; Phase 3 just collects what the PM wants to test.

---

## Where it lives

- **Route:** `/app/findings/[id]/experiment` — a dedicated page, not a modal
- **Entry point:** "Create experiment" button on the finding detail page (`/app/findings/[id]`)
- **Visibility:** Button appears when `finding.status === 'approved'` and `finding.prescription` is present
- **If an experiment already exists for this finding:** route shows the saved brief with an "Edit" affordance instead of the creation form

---

## The element selector question — decided here

**Background:** `CtaCandidate` and `HeadingItem` in our snapshot/capture schema do not store CSS selectors — only `ref` (stable hash), `text`, `tag`, and class-derived weight signals. We have `bbox` in `CtaCandidateMeasured` but no executable selector path.

**Decision: Text-based confirmation, not an element picker.**

Rationale:
1. For every finding with a prescription, the engine already named the element in natural language ("Give 'Start free trial' the visual weight..."). The PM doesn't need to pick — they need to confirm.
2. The output of this form is handed to a human developer, not executed by Zybit. A developer reading "button with text 'Start free trial' in the hero section" can find it — they don't need a CSS selector.
3. A click-in-iframe picker would require CSP negotiation and is out of scope for Phase 3.
4. A dropdown of all CTAs from the capture requires the capture to exist and is often overkill — if the finding has a prescription, the element is already identified.

**What the element field looks like:**

Pre-filled from the finding's evidence and prescription. A plain text input labeled "Element" with a suggested value derived from the finding:
- For `hero-hierarchy-inversion`: pre-fill with the value of the "Most-clicked CTA" evidence item (e.g. `"Start free trial"`)
- For `rage-click-target`: pre-fill with the value of the "Rage target" evidence item (e.g. `"Get started"`)
- For `form-abandonment`: pre-fill with the form landmark/page ref (e.g. `"Signup form on /signup"`)
- Fallback: empty, with placeholder `e.g. "Get started" button in hero`

PM can edit this field. It is free text — no validation. The point is to capture intent precisely enough for a dev to act on.

**Phase 4 enhancement (don't build now):** Add a "Show me on the page" affordance that opens the `screenshotBlobUrl` in a lightbox with CTA bboxes highlighted as click targets. Clicking a CTA populates the element field with `{text} in {landmark}`.

---

## Form fields

All fields have sensible defaults pre-populated from the finding. PM edits only what needs changing.

### 1. Experiment name
- Type: text input
- Default: `[finding.title] — Variant B`
- Max: 100 chars
- Label: "Experiment name"

### 2. Element
- Type: text input  
- Default: derived from evidence (see above)
- Placeholder: `e.g. "Get started" button in hero`
- Label: "Element to change"
- Help text: `Describe the element precisely enough for a developer to find it`

### 3. Change type
- Type: radio group (4 options)
- Options:
  - `copy` — "Change text copy" (default for most findings)
  - `style` — "Swap visual style" (default for `hero-hierarchy-inversion`)
  - `reorder` — "Move element" (default for fold-related findings)
  - `remove` — "Remove element"
- Default: inferred from finding category:
  - `rage` → `copy` (the element usually needs copy or handler fix)
  - `abandonment` → `copy` (submit button copy is the usual fix)
  - `hierarchy` → `style`
  - `fold` → `reorder`
  - all others → `copy`

### 4. Variant B description
- Type: textarea (4 rows)
- Default: `finding.prescription.experimentVariantDescription` verbatim
- Label: "Variant B description"
- Help text: `What the variant looks like. Your developer or A/B platform will use this.`

### 5. Primary metric
- Type: text input (free text — do not restrict to a fixed list)
- Default: inferred from finding category:
  - `rage` → `rage_click rate on [pathRef]`
  - `abandonment` → `form_submit rate on [pathRef]`
  - `hierarchy` → `CTA click-through rate on [pathRef]`
  - `bounce` → `bounce rate on [pathRef]`
  - all others → `conversion rate`
- Label: "Primary metric"
- Help text: `What you'll measure to declare a winner`

### 6. Hypothesis (optional)
- Type: textarea (3 rows)
- Default: empty
- Placeholder: `e.g. "Reducing visual emphasis on 'Book a demo' will increase 'Start free trial' clicks by 15%"`
- Label: "Hypothesis"

---

## Output — the experiment brief

On save, the form produces an `ExperimentBrief` stored as a JSONB column (`experiment_brief`) on the existing `zybitFindings` row. No new table needed.

```ts
interface ExperimentBrief {
  experimentName: string;
  element: string;
  changeType: 'copy' | 'style' | 'reorder' | 'remove';
  variantDescription: string;
  primaryMetric: string;
  hypothesis: string | null;
  createdAt: string;  // ISO
}
```

The detail page renders this as a copyable card:

```
┌──────────────────────────────────────────────────┐
│ EXPERIMENT BRIEF                                 │
│                                                  │
│ Start free trial — CTA hierarchy fix — Variant B │
│                                                  │
│ ELEMENT                                          │
│ "Start free trial" button in hero                │
│                                                  │
│ CHANGE                                           │
│ Swap visual style                                │
│                                                  │
│ VARIANT B                                        │
│ 'Start free trial' promoted to primary treatment │
│ (bg-blue-600 + text-white); 'Book a demo'        │
│ demoted to secondary (outline style).            │
│                                                  │
│ PRIMARY METRIC                                   │
│ CTA click-through rate on /                      │
│                                                  │
│ HYPOTHESIS                                       │
│ Aligning visual weight with click preference     │
│ will increase 'Start free trial' CTR by 15%      │
│                                                  │
│ [Copy brief]                      [Edit]         │
└──────────────────────────────────────────────────┘
```

"Copy brief" copies the brief as formatted text (not JSON) to the clipboard. Format is human-readable markdown:

```
**Experiment: [name]**
**Element:** [element]
**Change:** [changeType label]
**Variant B:** [variantDescription]
**Primary metric:** [primaryMetric]
**Hypothesis:** [hypothesis or "—"]
```

---

## Status lifecycle

After saving an experiment brief, the finding's status does NOT automatically change. The PM manually moves it through:

```
approved → shipped   (when they launch the experiment in their platform)
shipped → measured   (when they have results)
```

The existing `FindingStatusActions` already handles these transitions. No change needed.

---

## DB migration required

Add one column to `forge_findings`:

```sql
ALTER TABLE "forge_findings"
  ADD COLUMN IF NOT EXISTS "experiment_brief" jsonb;
```

Migration file: `drizzle/0009_findings_experiment_brief.sql`

Schema update:
```ts
experimentBrief: jsonb('experiment_brief').$type<ExperimentBrief | null>()
```

---

## Routes and files to build

| File | What it does |
|------|-------------|
| `drizzle/0009_findings_experiment_brief.sql` | Migration |
| `src/lib/db/schema.ts` | Add `experimentBrief` column |
| `src/app/app/findings/[id]/experiment/page.tsx` | The builder page (server component shell + form) |
| `src/app/app/findings/[id]/experiment/actions.ts` | `saveExperimentBriefAction` server action |
| `src/components/app/ExperimentBriefCard.tsx` | Read-only brief display with Copy button |
| `src/app/app/findings/[id]/page.tsx` | Add "Create experiment" / "View experiment" button |

---

## Brand DNA for this component

Same rules as EvidencePanel — warm, editorial, PM-first. Specific rules:

- The form page should feel like a structured design brief template, not a generic form. Section headers in the `text-[11px] font-bold uppercase tracking-[0.15em]` label style.
- Inputs: `border border-black/[0.1] rounded-lg px-3 py-2 text-sm text-[#111] bg-white focus:outline-none focus:ring-1 focus:ring-black/[0.2]`
- Radio buttons: don't use browser native radios. Each option is a pill-style button (`px-3 py-1.5 rounded-lg text-sm font-medium`). Selected state: `bg-[#111] text-[#FAFAF8]`. Unselected: `bg-black/[0.04] text-[#6B6B6B] hover:bg-black/[0.07]`.
- "Save brief" action button: flat brutalist — `bg-[#111] text-[#FAFAF8] px-5 py-2.5 font-bold text-sm uppercase tracking-[0.08em] hover:opacity-80` — NO border-radius.
- The output card (`ExperimentBriefCard`) uses `bg-white border border-black/[0.05] rounded-2xl p-6` consistent with evidence cards.
- "Copy brief" button: secondary style — `bg-white border border-black/[0.1] text-[#6B6B6B]`. After copy: brief flash to `text-emerald-600` text and `border-emerald-200` border for 1.5s, then revert.

---

## What NOT to build in PR 4

- No iframe element picker (Phase 4+)
- No screenshot lightbox with bbox overlays (Phase 4+)
- No direct push to LaunchDarkly / Optimizely (Phase 5+ integrations)
- No experiment results capture (Phase 4+, when status moves to `measured`)
- No "before/after" screenshot comparison
- No per-field confidence scores on the pre-filled values

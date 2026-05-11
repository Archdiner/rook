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

## Mutation model — decided here

**Client-side script injection is the deployment mechanism.** The script that ships in PR 5 reads an experiment manifest from the edge, buckets the visitor, and applies DOM mutations before meaningful paint. This means the modification builder must only offer mutations that client-side JavaScript can execute:

| Mutation type | What the script does | CSS selector needed? |
|---|---|---|
| `copy` | `el.textContent = newValue` | Yes |
| `style` | `el.classList.add/remove(...)` | Yes |
| `hide` | `el.style.display = 'none'` | Yes |

**Do not offer mutations the script cannot execute:** server-rendered logic, API-fetched prices, React component state, anything requiring a backend change. If the PM tries to test something outside this set, the right answer is "this needs a code change" — not a broken experiment.

## The element selector question — decided here

**Background:** The modification builder needs a CSS selector to target the element at runtime. Our snapshot/capture schema (`CtaCandidate`, `HeadingItem`) does not store CSS selectors — only `ref` (stable hash), `text`, `tag`, and class-derived signals. However, the finding's evidence often contains the element's text and class fragment in the `context` field.

**Decision: Auto-suggest from snapshot DOM elements, PM confirms or types a custom selector.**

The flow:
1. The engine already identifies the target element in every prescription (e.g., "Give 'Start free trial' the visual weight..."). Pre-populate the selector field with a best-guess derived from the finding's evidence (`refs.ctaRef`, evidence `context` fields).
2. Show a "Suggestions" dropdown built from the most recent page snapshot's `ctas[]` and `headings[]` arrays for the finding's `pathRef`. Each option shows `{tag} "{text}"` — clicking populates the selector field with `{tag}[data-ref="{ref}"]` or a text-content selector.
3. The PM can always type a raw CSS selector. No validation — the PM or their dev is responsible for correctness.

**Why not an iframe click-picker:** CSP headers on most production sites block cross-origin iframes. The visual editor (like VWO's) is Phase B work. For pilots, text + dropdown covers 95% of real findings.

**Selector derivation from evidence:**
- `rage-click-target`: use `refs.elementRef` if present, else build `button:has-text("${evidence['Rage target'].value}")`
- `hero-hierarchy-inversion`: use `refs.ctaRef` if present, else build `[contains text "${evidence['Most-clicked CTA'].value}"]`
- `form-abandonment`: target the submit button — `form button[type=submit]` or `form button:last-of-type`
- Fallback: empty field with placeholder `e.g. .hero h1, button.btn-primary`

**Phase B enhancement (don't build now):** Visual click-picker iframe with FOUC suppression, screenshot lightbox with bbox overlays, point-and-click selector generation.

---

## Form fields

All fields have sensible defaults pre-populated from the finding. PM edits only what needs changing.

### 1. Experiment name
- Type: text input
- Default: `[finding.title] — Variant B`
- Max: 100 chars
- Label: "Experiment name"

### 2. CSS selector
- Type: text input with "Suggestions" button
- Default: derived from finding evidence and `refs` (see selector derivation above)
- Placeholder: `e.g. .hero h1, button.btn-primary`
- Label: "CSS selector"
- Help text: `Targets the element the script will modify at runtime`
- "Suggestions" button opens a dropdown of `ctas[]` and `headings[]` from the most recent page snapshot for this finding's `pathRef`

### 3. Change type
- Type: radio group (3 options — only what the script can execute)
- Options:
  - `copy` — "Change text copy" (default for most findings)
  - `style` — "Swap CSS classes" (default for `hero-hierarchy-inversion`)
  - `hide` — "Hide element"
- Default: inferred from finding category:
  - `rage` → `copy`
  - `abandonment` → `copy`
  - `hierarchy` → `style`
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

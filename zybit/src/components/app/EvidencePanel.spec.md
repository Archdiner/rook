# EvidencePanel — Component Spec

> Write this component ONCE. Get it right the first time.
> Do not build until this spec has been validated against real engine output.

---

## What this component renders

`EvidencePanel` is the "why we said this" section of a finding detail page.
It receives a subset of `AuditFinding` and renders:

1. **Impact estimate** (if present) — the dollar/unit number front-and-center
2. **Evidence grid** — the structured `AuditFindingEvidence[]` items
3. **Prescription** (if present) — what to change, why it works, experiment variant
4. **Snapshot diagram** (if present) — form funnel or page-structure wireframe

---

## Props

```ts
interface EvidencePanelProps {
  evidence: AuditFindingEvidence[];
  prescription?: AuditFindingPrescription;
  impactEstimate?: AuditFindingImpactEstimate;
  snapshotDiagram?: SnapshotDiagram;
  recommendation: string[];   // fallback if no prescription
}
```

---

## Three real finding outputs (hand-written from engine source)

These are the ground truth. Rendering must match these shapes exactly.

---

### Finding 1 — Rage click cluster on /pricing

**Rule:** `rage-click-target`  
**Severity:** critical (rageRate 18% > 15% threshold)  
**Page:** /pricing

**Evidence array (engine output order):**
```json
[
  { "label": "Rage target",  "value": "Get started",  "context": "button.btn-primary btn-lg" },
  { "label": "Rage clicks",  "value": 47,             "context": "31 unique sessions" },
  { "label": "Rage rate",    "value": "18%",          "context": "31 of 174 page sessions" },
  { "label": "Page",         "value": "/pricing" },
  { "label": "Element role", "value": "navigation" }
]
```

**Impact estimate:**
```json
{
  "value": 1420,
  "unit": "USD",
  "period": "monthly",
  "formatted": "~$1,400/month",
  "basis": "18% affected rate × 174 sessions/day × 3% baseline conversion × $120 AOV × 30 days"
}
```

**Prescription:**
```json
{
  "whatToChange": "If 'Get started' is meant to be clickable: add a visible hover/focus state and verify its click handler fires. If it's decorative text or an icon: remove pointer cursor and change its visual treatment so it no longer reads as a button.",
  "whyItWorks": "18% of sessions on /pricing rage-click this element — visitors expect it to respond and it doesn't. Fixing affordance mismatches like this removes a frustration signal that erodes trust on conversion-critical pages.",
  "experimentVariantDescription": "Variant B: 'Get started' given correct interactive treatment (working handler + hover state) or visually demoted to plain text. Primary metric: rage_click rate on /pricing."
}
```

**Rendering notes:**
- `value: 47` → render as a large number with label "Rage clicks"
- `value: "18%"` → render as a large number/rate with label "Rage rate"
- `value: "Get started"` → render in monospace or quoted, smaller than metric numbers
- `context` renders as secondary text below the value
- The "Page" row is metadata, render at smaller weight than the signal rows

---

### Finding 2 — Form abandonment on /signup

**Rule:** `form-abandonment`  
**Severity:** critical (abandonmentRate 80% > 85% threshold... actually warn at 80%)  
**Page:** /signup

**Evidence array:**
```json
[
  { "label": "Page",              "value": "/signup" },
  { "label": "Form fields",       "value": 6,                                         "context": "landmark: main" },
  { "label": "Form views",        "value": 892,                                       "context": "distinct sessions" },
  { "label": "Form submits",      "value": 178,                                       "context": "distinct sessions" },
  { "label": "Abandonment rate",  "value": "80%" },
  { "label": "Required fields",   "value": "Email, Password, Company, Phone, Job title", "context": "top 5 of 5" },
  { "label": "Form landmark",     "value": "main" }
]
```

**Impact estimate:**
```json
{
  "value": 43,
  "unit": "signups",
  "period": "monthly",
  "formatted": "~43 signups/month",
  "basis": "80% affected rate × 892 form sessions/day × 3% baseline conversion × 30 days"
}
```

**Prescription:**
```json
{
  "whatToChange": "Change the submit button copy from 'Sign up' to a value-forward phrase like 'Get started — free'. Move any non-essential required fields (phone number, job title) to a second step after the user has already committed.",
  "whyItWorks": "80% of visitors start this form but never finish it. Each required field that isn't essential to lead intake is a drop-off gate. Reducing friction at the submit step and deferring optional fields typically improves form completion by 20–40% without reducing lead quality.",
  "experimentVariantDescription": "Variant B: submit button copy changed to 'Get started — free'; 'Job title' field moved to step 2. Primary metric: form_submit rate on /signup."
}
```

**Snapshot diagram:**
```json
{
  "type": "form-funnel",
  "pathRef": "/signup",
  "funnelSteps": [
    { "label": "Viewed form", "value": 892 },
    { "label": "Submitted",   "value": 178, "isFlagged": true }
  ],
  "items": [
    { "type": "form", "text": "Email",     "isFlagged": true,  "subtext": "required" },
    { "type": "form", "text": "Password",  "isFlagged": true,  "subtext": "required" },
    { "type": "form", "text": "Company",   "isFlagged": true,  "subtext": "required" },
    { "type": "form", "text": "Phone",     "isFlagged": true,  "subtext": "required" },
    { "type": "form", "text": "Job title", "isFlagged": true,  "subtext": "required" },
    { "type": "form", "text": "Referral",  "isFlagged": false, "subtext": "optional" }
  ],
  "proposedFix": "Move optional required fields to step 2. Rewrite submit button copy to reduce commitment anxiety."
}
```

**Rendering notes:**
- Funnel: render as two horizontal bars, `Submitted` bar is shorter and flagged amber
- Drop-off label: show the **percentage only** — "80% didn't finish", not "714 abandoned". The engine copy reads "80% of visitors start this form but never finish it" — match that framing throughout. Absolute counts are already in the evidence grid; the funnel communicates rate.
- Items list shows field names with a required/optional badge — flagged (`isFlagged: true`) fields get amber background, optional fields get gray
- `proposedFix` renders below the diagram as a one-sentence callout

---

### Finding 3 — Hero hierarchy inversion on /

**Rule:** `hero-hierarchy-inversion`  
**Severity:** warn (clickedShare 58% > 40% threshold)  
**Page:** /

**Evidence array:**
```json
[
  { "label": "Most-clicked CTA",      "value": "Start free trial", "context": "58% / 847 clicks" },
  { "label": "Visually heaviest CTA", "value": "Book a demo",      "context": "weight 12, bg-blue-600 text-white text-lg" },
  { "label": "Heaviest CTA position", "value": "header",           "context": "foldGuess: above" },
  { "label": "Page",                  "value": "/" },
  { "label": "Sample size",           "value": 1462,               "context": "CTA clicks in window" }
]
```

**Impact estimate:**
```json
{
  "value": 1260,
  "unit": "USD",
  "period": "monthly",
  "formatted": "~$1,300/month",
  "basis": "58% affected rate × 1,462 CTA clicks/day × 3% baseline conversion × $120 AOV × 30 days"
}
```

**Prescription:**
```json
{
  "whatToChange": "Give 'Start free trial' the visual weight currently held by 'Book a demo'. Specifically: apply bg-blue-600 + text-white to 'Start free trial' and demote 'Book a demo' to a secondary outlined style.",
  "whyItWorks": "Users vote with their clicks — 58% of CTA clicks go to 'Start free trial' but 'Book a demo' gets the most visual attention. Aligning design emphasis with user preference removes the mismatch that forces visitors to hunt for the thing they actually want.",
  "experimentVariantDescription": "Variant B: 'Start free trial' promoted to primary visual treatment; 'Book a demo' demoted to secondary. Primary metric: CTA click rate on /."
}
```

**Rendering notes:**
- "Most-clicked CTA" and "Visually heaviest CTA" are the KEY pair — they are always adjacent in engine output and must always share a row. On mobile (2-column grid) they would naturally split across rows, breaking the comparison that is the entire point of the finding. Treat these two items as a locked 2-up comparison block: render them as a dedicated full-width row with a `vs` divider, outside the regular grid flow, at every viewport width.
- The `context` on these items contains the actual diagnostic numbers (%, count, weight, classes)
- "Weight 12" is a computed visual weight score; display it plainly — don't explain the scale
- No snapshot diagram for hierarchy inversion (this rule doesn't emit one)

---

## Rendering contract

### Evidence grid layout

**Rule:** render evidence items in the order the engine emits them. Do not sort.

**Item types (inferred from value type and label):**
- `number` → large, bold. Format with commas (1,462, not 1462). Integers only.
- `string` that looks like a percentage ("18%", "80%") → large, bold, amber or red if flagged
- `string` that is a page path ("/pricing", "/signup") → monospace, normal weight
- `string` that is a CTA/element name ("Get started", "Book a demo") → quoted, normal weight
- `string` that is a CSS class fragment or technical context → small, muted

**Grid columns:** 2 on mobile, 3 on desktop. Each item fills one cell.

**Item cell structure:**
```
┌────────────────────────────┐
│ LABEL (11px uppercase)     │
│ Value (varies by type)     │
│ context (12px gray)        │
└────────────────────────────┘
```

**Special rendering for finding-1 evidence layout (preferred column order):**
```
┌──────────────┬──────────────┬──────────────┐
│ RAGE RATE    │ RAGE CLICKS  │ RAGE TARGET  │
│    18%       │     47       │ "Get started"│
│ 31/174 sess. │ 31 sessions  │ button.btn-  │
│              │              │ primary      │
├──────────────┴──────────────┴──────────────┤
│ PAGE: /pricing          ROLE: navigation   │
└────────────────────────────────────────────┘
```
Metadata rows (Page, Form landmark, Element role, Sample size) render at smaller scale below the primary evidence.

---

### Impact estimate banner

Render above the evidence grid, only when `impactEstimate` is present.

```
┌──────────────────────────────────────────────────────┐
│ ESTIMATED IMPACT                                     │
│ ~$1,400/month                                        │
│ 18% affected × 174 sessions/day × 3% conv × $120 AOV│
└──────────────────────────────────────────────────────┘
```

- **Color rule: derive from `impactEstimate.unit` — no extra prop needed.**
  `unit === "USD"` → `bg-[#111] text-[#FAFAF8]` (dark banner, revenue-framed finding).
  Anything else (`"signups"`, `"sessions"`, custom label) → `bg-amber-50 border border-amber-100 text-amber-900`.
  This is clean and doesn't require the caller to know the goal type.
- The `basis` string is the napkin math — show it in small text below the formatted value
- Never show the raw `value` number — only `formatted`

---

### Prescription card

Render below the evidence grid as a distinct section.

**Header:** "Recommended fix" in the same uppercase label style

**Three rows:**
1. `whatToChange` — body weight text, full width
2. `whyItWorks` — slightly lighter/smaller (text-sm text-[#6B6B6B])
3. `experimentVariantDescription` — prefixed "A/B variant:", in a code-ish block with bg-[#F5F5F3]

**If no prescription, render `recommendation[]`** paragraphs instead (one `<p>` per item in `recommendation`).

---

### Snapshot diagram

**Form funnel (type: form-funnel):**

```
Viewed form  ████████████████████████  892
Submitted    ████                      178  ← flagged (amber/red)
                                       ↑ 80% drop-off
```

Field list below: each field as a pill — required fields amber, optional gray.
```
[Email*] [Password*] [Company*] [Phone*] [Job title*] [Referral]
```

**Page structure (type: page-structure):**
Items above `foldAfterIndex` are above the fold. Items below are below.
Flagged items get an amber indicator.
(Not yet emitted by any current rule — reserved for future spec.)

---

## Brand DNA — required for this component

Zybit's visual identity is warm, premium, and editorial — not generic SaaS. Every rendering decision in EvidencePanel must express this. Violations here are the ones pilots will notice.

**Colors (from globals.css — not negotiable):**
- App background: `#FAFAF8` (warm cream). Cards sit on this — never use stark white as a base layer.
- Text primary: `#111`. Text muted: `#6B6B6B`.
- Card borders: `border-black/[0.05]` — extremely subtle, not visible as a frame.
- Severity mapping (from existing `SeverityBadge`):
  - `critical` → `bg-red-50 text-red-700 border-red-100`
  - `warn` → `bg-amber-50 text-amber-700 border-amber-100`
  - `info` → `bg-sky-50 text-sky-700 border-sky-100`
- Flagged states (form fields, funnel bars): amber (`bg-amber-50`, `text-amber-700`) — not generic red
- Impact banner USD: `bg-[#111] text-[#FAFAF8]` — the dark treatment is editorial, not alarming

**Typography:**
- Labels: `text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B]` — the established app-wide label style
- Large metric values (numbers, percentages): `text-3xl font-bold tracking-tighter text-[#111]`
- Body text in prescription: `text-sm text-[#111] leading-relaxed`
- `whyItWorks` prose: `text-sm text-[#6B6B6B] leading-relaxed`
- Monospace (paths, classes, code blocks): `font-mono text-xs bg-black/[0.04] px-1.5 py-0.5 rounded`

**Buttons:**
- Primary action in prescription (e.g. "Create experiment"): flat brutalist — `bg-[#111] text-[#FAFAF8] px-5 py-2.5 font-bold text-sm uppercase tracking-[0.08em] hover:opacity-80` — NO border-radius, NO pill shape

**Cards and layout:**
- Evidence cards: `bg-white border border-black/[0.05] rounded-2xl` — consistent with cockpit stat cards
- Section dividers: `border-t border-black/[0.04]` — nearly invisible
- The `bg-[#F5F5F3]` warm gray is the right background for code-ish blocks (experiment variant description)

**Tone rules (from DOCTRINE — PM-first means every string must be understandable without developer knowledge):**
- Don't explain what rage rate means; the PM knows their product
- Don't label things "debug info" or "technical detail" — just render or omit
- The prescription section should read like a design brief, not a bug report
- "A/B variant:" prefix on `experimentVariantDescription` is correct — it pre-fills the experiment builder they'll open next

---

## What NOT to render

- Do not render confidence score (0..1 float) — it's internal
- Do not render priorityScore — not user-facing
- Do not render ruleId or finding id
- Do not render `refs` (snapshotId, ctaRef, etc.) — internal
- Do not render the raw `value` from `impactEstimate` — only `formatted`
- Do not explain what "visual weight" means in the UI
- Do not add "Learn more" links or explanatory tooltips in Phase 3

---

## Known limitations

### CTA pair detection heuristic (fragile)

The locked 2-up comparison block for Finding 3 is triggered in `EvidenceGrid` by:

```ts
const isCTAPair =
  evidence.length >= 2 &&
  evidence[0].label.toLowerCase().includes("cta") &&
  evidence[1].label.toLowerCase().includes("cta");
```

**Why this is fragile:**
- Relies on the engine emitting the pair as the first two items in `evidence[]`
- Relies on both labels containing the string `"cta"` (case-insensitive)
- If a future rule uses different label names (`"Primary button"` / `"Secondary button"`) the block won't trigger and the pair will render as separate grid cells, breaking the comparison
- If the engine reorders evidence items, the detection silently breaks

**Phase 4 fix — `paired: true` engine flag:**
The engine should tag comparison pairs explicitly rather than the UI inferring from label text. Proposed engine output change:

```json
[
  { "label": "Most-clicked CTA", "value": "Start free trial", "context": "...", "paired": true },
  { "label": "Visually heaviest CTA", "value": "Book a demo", "context": "...", "paired": true },
  ...
]
```

The UI then checks `evidence[0].paired && evidence[1].paired` (or finds the first `paired` run) — no string matching required. This requires a type update to `AuditFindingEvidence` and changes to the `hero-hierarchy-inversion` rule emitter. Tag for Phase 4 cleanup; do not block Phase 3 on it.

---

## What to leave as stubs for Phase 4+

- Snapshot diagram for `page-structure` type (no rules emit it yet)
- `refs.snapshotId` deep-link to screenshot artifact
- `refs.ctaRef` highlighting in a page thumbnail
- `AuditFindingEvidence.paired` flag for locked comparison blocks (see Known limitations)

# Forge

Forge helps teams identify which product and UX changes are worth shipping next, based on observed user behavior instead of guesswork.

## Status

Forge is pre-product. **Phase 1 core** (sufficiency + insights engines, Phase 1 HTTP APIs, org-aware repository layer) is implemented; verify locally with `npm run build` and the API curls below.

When `DATABASE_URL` is set, `PHASE1_STORAGE_DRIVER=auto` selects Postgres (ensure migrations are applied). To smoke-test APIs without Postgres: `PORT=3020 DATABASE_URL= PHASE1_STORAGE_DRIVER=blob npm run start`.

**Commercial roadmap:** see `[docs/CUSTOMER_READINESS_BACKLOG.md](docs/CUSTOMER_READINESS_BACKLOG.md)` (FORGE-* epics: auth, billing, onboarding, persisted runs).

**Full product narrative (Phases 0–4):** see `[docs/PRODUCT_PRD.md](docs/PRODUCT_PRD.md)`. **Site improver positioning, credibility demos, DNA model, autonomy boundaries:** see `[docs/SITE_IMPROVER_VISION_PRD.md](docs/SITE_IMPROVER_VISION_PRD.md)`. **Phase 2 evidence contract:** see `[docs/PHASE2_EVIDENCE_MODEL.md](docs/PHASE2_EVIDENCE_MODEL.md)`. For private scratch PRD drafts, keep a local file such as `PRD.full.md` (ignored by git when listed in `.gitignore`).

**Interactive API docs** (marketing-site visuals + particle background): open `**/docs`** on your deployment (e.g. `https://your-app.vercel.app/docs`).

## What Exists Today

- Discovery survey flow with server-side intake handling (`src/app/discovery`, `src/app/api/discovery/route.ts`)
- Phase 1 API surface for site setup, event ingestion, readiness checks, and recommendations (`src/app/api/phase1`)
- Data sufficiency engine with deterministic thresholds and readiness scoring (`src/lib/phase1/sufficiency`)
- Insights engine that ranks evidence-backed findings from behavioral aggregates (`src/lib/phase1/insights`)
- **Phase 2 spine:** versioned canonical events with `(siteId, source, sourceEventId)` dedupe, per-site config CRUD, rollup pipeline (`src/lib/phase2`), validation gate, **`POST /api/phase2/insights/run`**, and **`POST /api/phase2/insights/receipt`** (`forge.receipt.v1` exports)
- **PostHog connector:** first-class provider integration (`src/lib/phase2/connectors/posthog`) with mapping, paginated sync, retry/backoff, validate route, and secret-ref auth (no plaintext tokens in storage)

## Local Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Before opening a PR, run **`npm run verify`** (lint + TypeScript check + production build).

## Environment Variables


| Variable                     | Required                                                    | Used for                                                                                             |
| ---------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`             | Yes (for discovery/intake email delivery)                   | Sends responses from `POST /api/discovery` and `POST /api/intake`                                    |
| `BLOB_READ_WRITE_TOKEN`      | Optional in local dev, required for Vercel Blob persistence | Discovery: one JSON file per response; Phase 1: partitioned JSON per record (see architecture below) |
| `PHASE1_STORAGE_DRIVER`      | Optional (`auto` default)                                   | Selects repository backend: `auto`, `blob`, or `postgres`                                            |
| `DATABASE_URL`               | Required when using `postgres` driver                       | Neon/Postgres connection string used by Drizzle repository                                           |
| `NEXT_PUBLIC_DEFAULT_ORG_ID` | Optional (`org_default`)                                    | Fallback organization context when no `organizationId` query/header is provided                      |
| `PHASE1_ORG_IDENTITY_MODE`   | Optional (`dev` default)                                    | `dev` allows query/body fallback; `header_required` requires `x-org-id` header                       |


Phase 2 reuses the same env matrix; no additional secrets are required for the
spine (rollups + gate + insights run).

For provider connectors, **secrets live in env vars referenced by `secretRef`
on the integration record** — never in DB rows. For PostHog, set:


| Variable                                     | Required                         | Used for                                                                                                                                                         |
| -------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTHOG_API_KEY__<SITE_OR_INTEGRATION_TAG>` | When using the PostHog connector | Personal API key with read scope on the project; the env var name is stored as `secretRef` on the integration record. Forge resolves it server-side per request. |


Without `BLOB_READ_WRITE_TOKEN`, Phase 1 storage falls back to local temporary files.

## API Quickstart (Phase 1)

Set a base URL:

```bash
export BASE_URL="http://localhost:3000"
```

Health check:

```bash
curl -s "$BASE_URL/api/phase1/health"
```

Create a site:

```bash
curl -s -X POST "$BASE_URL/api/phase1/sites" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Store",
    "domain": "acme.com",
    "analyticsProvider": "shopify"
  }'
```

Ingest one event:

```bash
curl -s -X POST "$BASE_URL/api/phase1/events" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "replace-with-site-id",
    "sessionId": "session-1",
    "type": "page_view",
    "path": "/pricing",
    "metrics": { "dwellMs": 3400 }
  }'
```

Readiness snapshot:

```bash
curl -s "$BASE_URL/api/phase1/readiness?siteId=replace-with-site-id"
```

Recommendations:

```bash
curl -s "$BASE_URL/api/phase1/recommendations?siteId=replace-with-site-id"
```

Sufficiency engine endpoint:

```bash
curl -s -X POST "$BASE_URL/api/phase1/sufficiency" \
  -H "Content-Type: application/json" \
  -d '{
    "evidence": {
      "sessions": 120,
      "events": 420,
      "conversions": 18
    }
  }'
```

Insights engine endpoint:

```bash
curl -s -X POST "$BASE_URL/api/phase1/insights" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "replace-with-site-id",
    "totals": { "sessions": 1200 },
    "cohorts": [],
    "narratives": [],
    "onboarding": [],
    "ctas": [],
    "deadEnds": [],
    "maxFindings": 3
  }'
```

## API Quickstart (Phase 2)

Phase 2 derives the insights `InsightInput` from your stored canonical events
plus a per-site config; you do not need to pre-shape aggregates.

Phase 2 health:

```bash
curl -s "$BASE_URL/api/phase2/health"
```

Declare site config (cohort dimensions, onboarding, CTAs, narratives):

```bash
curl -s -X PUT "$BASE_URL/api/phase2/sites/replace-with-site-id/config" \
  -H "Content-Type: application/json" \
  -d '{
    "cohortDimensions": [
      { "id": "utm_source", "label": "UTM source", "source": "property", "key": "utm_source", "fallback": "direct" }
    ],
    "onboardingSteps": [
      { "id": "view_pricing", "label": "View pricing", "order": 1, "match": { "kind": "path-prefix", "prefix": "/pricing" } },
      { "id": "start_checkout", "label": "Start checkout", "order": 2, "match": { "kind": "event-type", "type": "checkout_start" } }
    ],
    "ctas": [
      { "pageRef": "/pricing", "ctaId": "buy_now", "label": "Buy now", "visualWeight": 0.9, "match": { "kind": "event-type", "type": "cta_click" } }
    ],
    "narratives": [
      { "id": "pricing_story", "label": "Pricing narrative", "sourcePathRef": "/pricing", "expectedPathRefs": ["/checkout", "/cart"] }
    ]
  }'
```

Send a canonical event (note `occurredAt`, `source`, `sourceEventId`):

```bash
curl -s -X POST "$BASE_URL/api/phase1/events" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "replace-with-site-id",
    "sessionId": "session-1",
    "type": "page_view",
    "path": "/pricing",
    "occurredAt": "2026-04-15T12:00:00Z",
    "source": "shopify",
    "sourceEventId": "shopify_evt_123",
    "properties": { "utm_source": "newsletter" }
  }'
```

Run Phase 2 insights end-to-end:

```bash
curl -s -X POST "$BASE_URL/api/phase2/insights/run" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "replace-with-site-id",
    "window": { "start": "2026-04-01T00:00:00Z", "end": "2026-04-22T00:00:00Z" },
    "maxFindings": 5
  }'
```

The response includes `findings`, `warnings` (gate output), `diagnostics`, and a
`trustworthy` boolean. See `[docs/PHASE2_EVIDENCE_MODEL.md](docs/PHASE2_EVIDENCE_MODEL.md)`
for the full contract and what each warning code means.

### Receipt export (`forge.receipt.v1`)

Same POST body as above; wraps the identical run payload in **`{ schemaVersion, exportedAt, run }`**:

```bash
curl -s -X POST "$BASE_URL/api/phase2/insights/receipt" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "replace-with-site-id",
    "window": { "start": "2026-04-01T00:00:00Z", "end": "2026-04-22T00:00:00Z" },
    "maxFindings": 5
  }'
```

Download a **Markdown receipt** attachment (credibility demos, Slack/email):

```bash
curl -s -JO -X POST "$BASE_URL/api/phase2/insights/receipt?format=markdown" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "replace-with-site-id",
    "window": { "start": "2026-04-01T00:00:00Z", "end": "2026-04-22T00:00:00Z" },
    "maxFindings": 5
  }'
```

(`-JO` saves using `Content-Disposition` filename with curl.)

### PostHog connector

Forge ships a first-class **PostHog** connector. Set the env var first:

```bash
export POSTHOG_API_KEY__SITE_123="phx_..."
```

Then create the integration:

```bash
curl -s -X POST "$BASE_URL/api/phase2/integrations" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "replace-with-site-id",
    "provider": "posthog",
    "config": { "host": "https://us.posthog.com", "projectId": "12345" },
    "secretRef": "POSTHOG_API_KEY__SITE_123"
  }'
```

Validate the connection (no writes):

```bash
curl -s -X POST "$BASE_URL/api/phase2/integrations/$INTEGRATION_ID/validate"
```

Pull events into Forge (idempotent on PostHog `uuid`):

```bash
curl -s -X POST "$BASE_URL/api/phase2/integrations/$INTEGRATION_ID/sync" \
  -H "Content-Type: application/json" \
  -d '{ "maxEvents": 1000 }'
```

Then call `/api/phase2/insights/run` and findings come from real PostHog data.
Mapping table and credential checklist live in `[docs/PHASE2_EVIDENCE_MODEL.md](docs/PHASE2_EVIDENCE_MODEL.md)` §9.

### Page DNA snapshots (design audit grounding)

To make findings *tasteful* — naming the actual H1, the actual button,
the actual class signals — Forge takes static snapshots of customer
pages. Each snapshot stores meta tags, heading hierarchy, CTA inventory
(with visual-weight signals), and forms.

```bash
curl -s -X POST "$BASE_URL/api/phase2/sites/replace-with-site-id/snapshots" \
  -H "Content-Type: application/json" \
  -H "x-org-id: org_abc123" \
  --data '{
    "baseUrl": "https://example.com",
    "paths":   ["/", "/pricing", "/signup"]
  }'
```

Returns a per-path report; failures are non-fatal and tagged with a
structured `errorCode` (`TIMEOUT`, `BLOCKED_BY_ROBOTS`, `NON_HTML`, ...).
List snapshots or fetch a single page:

```bash
curl -s "$BASE_URL/api/phase2/sites/$SITE_ID/snapshots" -H "x-org-id: org_abc123"
curl -s "$BASE_URL/api/phase2/sites/$SITE_ID/snapshots?pathRef=/pricing" -H "x-org-id: org_abc123"
```

See `[docs/PHASE2_EVIDENCE_MODEL.md](docs/PHASE2_EVIDENCE_MODEL.md)` §10
for the full snapshot contract and visual-weight scoring rubric.

### Audit rules (designer- and researcher-voiced findings)

With both snapshots and PostHog events on hand, Forge runs a set of
**audit rules** that produce findings naming actual elements, actual
error messages, actual form fields, actual cohort labels:

```jsonc
{
  "auditReport": {
    "findings": [
      {
        "ruleId": "hero-hierarchy-inversion",
        "category": "hierarchy",
        "pathRef": "/pricing",
        "title": "Visual hierarchy inverts user preference on /pricing",
        "summary": "Most-clicked CTA on /pricing is `Start free trial` (38% of CTA clicks, 1,420 clicks). The visually heaviest CTA is `Book demo` (visual weight 0.82, signals: text-2xl, bg-primary, font-bold).",
        "recommendation": [
          "Either reduce the visual weight of `Book demo` or raise `Start free trial` to match. The eye should land where the value lands, and right now those are different places.",
          "Concretely: drop bg-primary from `Book demo`, or promote `Start free trial` into the same header position and give it text-2xl + bg-primary."
        ],
        "evidence": [...]
      },
      {
        "ruleId": "form-abandonment",
        "category": "abandonment",
        "pathRef": "/signup",
        "title": "85% abandon the 6-field form on /signup",
        "summary": "Visitors view the 6-field form on /signup 2,140 times in the window but submit only 312 times — 85% abandonment. Required fields visible: `email`, `phone_number`, `company_size`.",
        "recommendation": [...]
      }
    ],
    "diagnostics": [...],
    "groundedInSnapshots": true
  }
}
```

**Design rules** (Layer C): `hero-hierarchy-inversion`,
`above-fold-coverage`, `rage-click-target`,
`mobile-engagement-asymmetry`, `nav-dispersion`.

**Pain rules** (Layer D): `form-abandonment`, `help-seeking-spike`,
`hesitation-pattern`, `bounce-on-key-page`, `error-exposure`,
`return-visit-thrash`, `cohort-pain-asymmetry`.

> **Naming note:** the response field is `auditReport` (formerly
> `designReport`). The interface `AuditFinding` (formerly
> `DesignFinding`) and helper `runAuditRules` (formerly
> `runDesignRules`) reflect that the rule set spans both design and
> user-pain patterns now.

See `[docs/PHASE2_EVIDENCE_MODEL.md](docs/PHASE2_EVIDENCE_MODEL.md)`
§§11–14.

## Architecture (High Level)

- Next.js App Router app with UI routes and API routes in a single service
- Deterministic analysis core in `src/lib/phase1` (pure logic for sufficiency and insights)
- API routes validate inputs and map requests to domain engines
- Org-aware repository layer supports `blob` and `postgres` drivers, with auto-selection via env config
- Blob driver persists **one JSON object per record** (partitioned paths; no concurrent append on shared NDJSON for Phase 1); legacy monthly NDJSON may still be **read** for migration
- Discovery responses use **one blob per submission** (see `src/app/api/discovery/route.ts`)
- Postgres driver stores sites, events, and readiness snapshots in relational tables (apply Drizzle migrations)
- Org identity resolution can be strict in production via `PHASE1_ORG_IDENTITY_MODE=header_required`

## Repository Structure

- `docs` - Product PRD (`PRODUCT_PRD.md`), site-improver vision PRD (`SITE_IMPROVER_VISION_PRD.md`), Phase 2 evidence model
- `src/app` - Pages and route handlers
- `src/app/api/discovery` - Discovery survey API
- `src/app/api/intake` - General intake API
- `src/app/api/phase1` - Phase 1 endpoints (health, sites, events, readiness, recommendations, sufficiency, insights)
- `src/app/api/phase2` - Phase 2 endpoints (health, site config, insights/run, insights/receipt, integrations, page snapshots)
- `src/lib/phase1` - Core contracts, storage adapter, sufficiency engine, insights engine
- `src/lib/phase2` - Canonical event schema, per-site config, rollup pipeline, validation gate
- `src/lib/phase2/connectors/posthog` - PostHog connector (mapping, paginated sync, retry/backoff, secret resolution, elements_chain ancestry parser)
- `src/lib/phase2/snapshots` - Page DNA static analysis (fetcher, parser, visual-weight scoring, fold guess)
- `src/lib/phase2/rules` - Audit rules. Design: hero-hierarchy-inversion, above-fold-coverage, rage-click-target, mobile-engagement-asymmetry, nav-dispersion. Pain: form-abandonment, help-seeking-spike, hesitation-pattern, bounce-on-key-page, error-exposure, return-visit-thrash, cohort-pain-asymmetry
- `drizzle` - Generated Postgres migrations (`drizzle-kit generate`)
- `public` - Static assets

## Roadmap

See **[docs/PRODUCT_PRD.md](docs/PRODUCT_PRD.md)** for goals, success criteria, and non-goals per phase, and **[docs/SITE_IMPROVER_VISION_PRD.md](docs/SITE_IMPROVER_VISION_PRD.md)** for north-star differentiation (credentials, receipts, DNA, third-party stack).

- **Phase 0**: Discovery and problem validation
- **Phase 1**: Data sufficiency, readiness scoring, deterministic insights/recommendations
- **Phase 2**: Deeper instrumentation integrations and richer evidence models
- **Phase 3**: Guided action loops and outcome tracking
- **Phase 4**: Production hardening, operator workflows, and broader rollout

## Contributing

Contributions are welcome. Open an issue or pull request with a clear problem statement, scope, and validation steps.
# Forge

Forge helps teams identify which product and UX changes are worth shipping next, based on observed user behavior instead of guesswork.

## Status

Forge is pre-product. **Phase 1 core** (sufficiency + insights engines, Phase 1 HTTP APIs, org-aware repository layer) is implemented; verify locally with `npm run build` and the API curls below.

When `DATABASE_URL` is set, `PHASE1_STORAGE_DRIVER=auto` selects Postgres (ensure migrations are applied). To smoke-test APIs without Postgres: `PORT=3020 DATABASE_URL= PHASE1_STORAGE_DRIVER=blob npm run start`.

**Full product narrative (Phases 0–4):** see [`docs/PRODUCT_PRD.md`](docs/PRODUCT_PRD.md). For private scratch PRD drafts, keep a local file such as `PRD.full.md` (ignored by git when listed in `.gitignore`).

## What Exists Today

- Discovery survey flow with server-side intake handling (`src/app/discovery`, `src/app/api/discovery/route.ts`)
- Phase 1 API surface for site setup, event ingestion, readiness checks, and recommendations (`src/app/api/phase1`)
- Data sufficiency engine with deterministic thresholds and readiness scoring (`src/lib/phase1/sufficiency`)
- Insights engine that ranks evidence-backed findings from behavioral aggregates (`src/lib/phase1/insights`)

## Local Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment Variables

| Variable | Required | Used for |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes (for discovery/intake email delivery) | Sends responses from `POST /api/discovery` and `POST /api/intake` |
| `BLOB_READ_WRITE_TOKEN` | Optional in local dev, required for Vercel Blob persistence | Discovery: one JSON file per response; Phase 1: partitioned JSON per record (see architecture below) |
| `PHASE1_STORAGE_DRIVER` | Optional (`auto` default) | Selects repository backend: `auto`, `blob`, or `postgres` |
| `DATABASE_URL` | Required when using `postgres` driver | Neon/Postgres connection string used by Drizzle repository |
| `NEXT_PUBLIC_DEFAULT_ORG_ID` | Optional (`org_default`) | Fallback organization context when no `organizationId` query/header is provided |
| `PHASE1_ORG_IDENTITY_MODE` | Optional (`dev` default) | `dev` allows query/body fallback; `header_required` requires `x-org-id` header |

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

- `docs` - Product PRD and phase narrative (`PRODUCT_PRD.md`)
- `src/app` - Pages and route handlers
- `src/app/api/discovery` - Discovery survey API
- `src/app/api/intake` - General intake API
- `src/app/api/phase1` - Phase 1 endpoints (health, sites, events, readiness, recommendations, sufficiency, insights)
- `src/lib/phase1` - Core contracts, storage adapter, sufficiency engine, insights engine
- `public` - Static assets

## Roadmap

See **[`docs/PRODUCT_PRD.md`](docs/PRODUCT_PRD.md)** for goals, success criteria, and non-goals per phase.

- **Phase 0**: Discovery and problem validation
- **Phase 1**: Data sufficiency, readiness scoring, deterministic insights/recommendations
- **Phase 2**: Deeper instrumentation integrations and richer evidence models
- **Phase 3**: Guided action loops and outcome tracking
- **Phase 4**: Production hardening, operator workflows, and broader rollout

## Contributing

Contributions are welcome. Open an issue or pull request with a clear problem statement, scope, and validation steps.

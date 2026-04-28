# Phase 1 persistence scaffold

This folder contains the optional Postgres persistence path for Phase 1.

## Environment

- `PHASE1_STORAGE_DRIVER=auto|blob|postgres`
- `DATABASE_URL=<neon/postgres connection string>`
- `NEXT_PUBLIC_DEFAULT_ORG_ID=org_default`

## Generate migrations

From `forge/`:

```bash
npx drizzle-kit generate
```

This writes SQL files to `forge/drizzle/`.

## Apply migrations

Use your preferred migration runner against `DATABASE_URL`. This project currently ships schema + repository scaffolding so Phase 1 can keep running on blob/local fallback until Postgres rollout is enabled.

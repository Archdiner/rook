# Postgres persistence

Zybit uses Postgres (Neon serverless) via Drizzle ORM.

## Environment

- `DATABASE_URL=<neon/postgres connection string>` (required)

## Generate migrations

From `zybit/`:

```bash
npx drizzle-kit generate
```

Writes SQL files to `zybit/drizzle/`.

## Apply migrations

Apply against `DATABASE_URL` before first run:

```bash
psql $DATABASE_URL -f zybit/drizzle/0000_phase2_canonical_events.sql
psql $DATABASE_URL -f zybit/drizzle/0001_phase2_page_snapshots.sql
psql $DATABASE_URL -f zybit/drizzle/0002_zybit_api_keys.sql
psql $DATABASE_URL -f zybit/drizzle/0003_zybit_dashboard_tables.sql
```

/**
 * ONE-TIME SETUP ENDPOINT — DELETE AFTER USE
 *
 * Runs the zybit_experiment_outcomes migration and seeds two admin users.
 * Protected by a single-use secret. Remove this file after calling it.
 *
 * Usage:
 *   curl -s -X POST https://getzybit.com/api/admin/setup \
 *     -H "Authorization: Bearer d23f46534b702d035191b4b71fb47d9036b3e3118af33012" \
 *     -H "Content-Type: application/json" | jq
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const SETUP_SECRET = 'd23f46534b702d035191b4b71fb47d9036b3e3118af33012';

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "zybit_experiment_outcomes" (
  "id"                    text PRIMARY KEY,
  "organization_id"       text NOT NULL,
  "site_id"               text NOT NULL,
  "experiment_id"         text NOT NULL,
  "finding_id"            text,
  "rule_id"               text,
  "path_ref"              text,
  "modification_type"     text,
  "result"                text NOT NULL,
  "lift_pct"              real,
  "confidence"            real,
  "control_conversions"   integer,
  "control_participants"  integer,
  "variant_conversions"   integer,
  "variant_participants"  integer,
  "guardrail_breached"    text,
  "concluded_at"          timestamptz NOT NULL,
  "created_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "zybit_outcomes_experiment_idx" ON "zybit_experiment_outcomes" ("experiment_id");
CREATE INDEX IF NOT EXISTS "zybit_outcomes_site_idx"       ON "zybit_experiment_outcomes" ("site_id");
CREATE INDEX IF NOT EXISTS "zybit_outcomes_org_idx"        ON "zybit_experiment_outcomes" ("organization_id");
`;

const USERS_TO_CREATE = [
  { email: 'asad@getzybit.com', role: 'admin' },
  { email: 'jad@getzybit.com',  role: 'admin' },
];

export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${SETUP_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });
  }

  const sql = neon(databaseUrl);
  const results: Record<string, unknown> = {};

  // 1. Run migration
  try {
    await sql.transaction([
      sql`
        CREATE TABLE IF NOT EXISTS "zybit_experiment_outcomes" (
          "id"                    text PRIMARY KEY,
          "organization_id"       text NOT NULL,
          "site_id"               text NOT NULL,
          "experiment_id"         text NOT NULL,
          "finding_id"            text,
          "rule_id"               text,
          "path_ref"              text,
          "modification_type"     text,
          "result"                text NOT NULL,
          "lift_pct"              real,
          "confidence"            real,
          "control_conversions"   integer,
          "control_participants"  integer,
          "variant_conversions"   integer,
          "variant_participants"  integer,
          "guardrail_breached"    text,
          "concluded_at"          timestamptz NOT NULL,
          "created_at"            timestamptz NOT NULL DEFAULT now()
        )
      `,
      sql`CREATE INDEX IF NOT EXISTS "zybit_outcomes_experiment_idx" ON "zybit_experiment_outcomes" ("experiment_id")`,
      sql`CREATE INDEX IF NOT EXISTS "zybit_outcomes_site_idx" ON "zybit_experiment_outcomes" ("site_id")`,
      sql`CREATE INDEX IF NOT EXISTS "zybit_outcomes_org_idx" ON "zybit_experiment_outcomes" ("organization_id")`,
    ]);
    results.migration = 'ok — zybit_experiment_outcomes table created (or already existed)';
  } catch (err) {
    results.migration = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 2. Find or create organization
  let orgId: string;
  try {
    const existingOrgs = await sql`SELECT id, name FROM organizations LIMIT 1`;
    if (existingOrgs.length > 0) {
      orgId = existingOrgs[0].id as string;
      results.org = `using existing org: ${orgId} (${existingOrgs[0].name})`;
    } else {
      orgId = 'org_default';
      await sql`
        INSERT INTO organizations (id, name, plan, created_at)
        VALUES (${orgId}, 'Zybit', 'growth', NOW())
        ON CONFLICT (id) DO NOTHING
      `;
      results.org = `created org: ${orgId}`;
    }
  } catch (err) {
    return NextResponse.json({
      error: `Failed to resolve org: ${err instanceof Error ? err.message : String(err)}`,
      partial: results,
    }, { status: 500 });
  }

  // 3. Create users
  const userResults: string[] = [];
  for (const { email, role } of USERS_TO_CREATE) {
    try {
      const existing = await sql`SELECT id FROM app_users WHERE email = ${email} LIMIT 1`;
      if (existing.length > 0) {
        // Update to approved if needed
        await sql`
          UPDATE app_users SET status = 'approved', role = ${role}
          WHERE email = ${email}
        `;
        userResults.push(`${email}: already exists, ensured status=approved role=${role}`);
      } else {
        const userId = randomUUID();
        await sql`
          INSERT INTO app_users (id, email, organization_id, role, status, created_at)
          VALUES (${userId}, ${email}, ${orgId}, ${role}, 'approved', NOW())
        `;
        userResults.push(`${email}: created (id=${userId})`);
      }
    } catch (err) {
      userResults.push(`${email}: error — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  results.users = userResults;

  // 4. Confirm final state
  try {
    const users = await sql`
      SELECT id, email, organization_id, role, status FROM app_users ORDER BY created_at
    `;
    results.allUsers = users;
  } catch {
    results.allUsers = 'could not query';
  }

  void MIGRATION_SQL; // referenced in comment above
  return NextResponse.json({ success: true, results });
}

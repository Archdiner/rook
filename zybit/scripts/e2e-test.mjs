/**
 * End-to-end test for the magic-link auth flow.
 * Run with: node scripts/e2e-test.mjs
 *
 * Tests:
 * 1. /admin/login page is accessible
 * 2. Admin login API (POST /api/admin/login) sets zb_admin cookie
 * 3. Admin users API (GET/POST /api/admin/users) requires valid cookie
 * 4. Create a test user and verify in DB
 * 5. Magic link request (POST /api/auth/request-link)
 * 6. Inject magic link token directly into DB, test callback URL
 * 7. Verify zb_session cookie set and redirect to /app
 * 8. Verify /app accessible with session cookie
 * 9. Sign-out clears session
 * 10. Verify revoke invalidates session
 */

import { createHash, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = 'test-admin-secret-123';
const TEST_EMAIL = `e2e-test-${Date.now()}@example.com`;
const DB_URL = process.env.DATABASE_URL;

const sql = neon(DB_URL);

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function generateToken() {
  return randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function get(path, opts = {}) {
  return fetch(`${BASE_URL}${path}`, { redirect: 'manual', ...opts });
}

async function post(path, body, opts = {}) {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    body: JSON.stringify(body),
    redirect: 'manual',
    ...opts,
  });
}

function extractCookie(res, name) {
  const all = res.headers.getSetCookie?.() ?? [];
  for (const c of all) {
    const match = c.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

// ─────────────────────────────────────────────
console.log('\n1. Public page accessibility');
// ─────────────────────────────────────────────
{
  const r1 = await get('/');
  assert(r1.status === 200, `GET / → 200`);

  const r2 = await get('/sign-in');
  assert(r2.status === 200, `GET /sign-in → 200`);

  const r3 = await get('/admin/login');
  assert(r3.status === 200, `GET /admin/login → 200`);

  const r4 = await get('/admin');
  assert(r4.status === 307 && r4.headers.get('location')?.includes('/admin/login'),
    `GET /admin (no cookie) → 307 to /admin/login`);

  const r5 = await get('/app');
  assert(r5.status === 307 && r5.headers.get('location')?.includes('/sign-in'),
    `GET /app (no cookie) → 307 to /sign-in`);
}

// ─────────────────────────────────────────────
console.log('\n2. Admin login');
// ─────────────────────────────────────────────
let adminCookie;
{
  const r = await post('/api/admin/login', { password: 'wrong-password' });
  const body = await r.json();
  assert(r.status === 401, `Wrong password → 401`);

  const r2 = await post('/api/admin/login', { password: ADMIN_PASSWORD });
  assert(r2.status === 307 || r2.status === 302, `Correct password → redirect`);
  adminCookie = extractCookie(r2, 'zb_admin');
  assert(!!adminCookie, `zb_admin cookie set`);
}

// ─────────────────────────────────────────────
console.log('\n3. Admin users API');
// ─────────────────────────────────────────────
let testUserId, testOrgId;
{
  // Without cookie → 401
  const r1 = await get('/api/admin/users');
  assert(r1.status === 401, `GET /api/admin/users (no cookie) → 401`);

  // With cookie → 200
  const r2 = await get('/api/admin/users', {
    headers: { Cookie: `zb_admin=${adminCookie}` },
  });
  assert(r2.status === 200, `GET /api/admin/users (with cookie) → 200`);

  // Create test user
  const r3 = await post('/api/admin/users', { email: TEST_EMAIL, orgName: 'E2E Test Org' }, {
    headers: { Cookie: `zb_admin=${adminCookie}` },
  });
  assert(r3.status === 200, `POST /api/admin/users → 200`);
  const userData = await r3.json();
  testUserId = userData.userId;
  testOrgId = userData.orgId;
  assert(typeof testUserId === 'string', `Got userId: ${testUserId}`);
  assert(typeof testOrgId === 'string' && testOrgId.startsWith('org_'), `Got orgId: ${testOrgId}`);

  // Duplicate → 409
  const r4 = await post('/api/admin/users', { email: TEST_EMAIL }, {
    headers: { Cookie: `zb_admin=${adminCookie}` },
  });
  assert(r4.status === 409, `Duplicate email → 409`);

  // Verify user in DB
  const rows = await sql`SELECT id, email, status FROM app_users WHERE id = ${testUserId}`;
  assert(rows.length === 1 && rows[0].status === 'approved', `User in DB with status=approved`);
}

// ─────────────────────────────────────────────
console.log('\n4. Magic link request');
// ─────────────────────────────────────────────
{
  // Non-existent email → generic OK (no enumeration)
  const r1 = await post('/api/auth/request-link', { email: 'nobody@nowhere.com' });
  assert(r1.status === 200, `Unknown email → 200 (no enumeration)`);

  // Valid email → generic OK (even if Resend fails)
  const r2 = await post('/api/auth/request-link', { email: TEST_EMAIL });
  assert(r2.status === 200, `Known email → 200`);

  // Verify magic link was written to DB
  const links = await sql`SELECT id, token_hash FROM auth_magic_links WHERE email = ${TEST_EMAIL} LIMIT 1`;
  assert(links.length === 1, `auth_magic_links row created`);

  // Invalid body
  const r3 = await post('/api/auth/request-link', { email: 'notanemail' });
  assert(r3.status === 400, `Invalid email format → 400`);
}

// ─────────────────────────────────────────────
console.log('\n5. Auth callback (inject token directly)');
// ─────────────────────────────────────────────
let sessionCookie;
{
  // Create a fresh magic link directly in DB with a known token
  const plainToken = generateToken();
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await sql`
    INSERT INTO auth_magic_links (id, email, token_hash, expires_at)
    VALUES (gen_random_uuid(), ${TEST_EMAIL}, ${tokenHash}, ${expiresAt.toISOString()})
  `;

  // Test callback with valid token
  const r1 = await get(`/api/auth/callback?token=${encodeURIComponent(plainToken)}`);
  assert(r1.status === 307 || r1.status === 302, `Valid callback → redirect`);
  const loc = r1.headers.get('location');
  assert(loc?.includes('/app'), `Redirect target is /app (got: ${loc})`);
  sessionCookie = extractCookie(r1, 'zb_session');
  assert(!!sessionCookie, `zb_session cookie set`);

  // Using same token again → consumed, should redirect to /sign-in?error=invalid
  const r2 = await get(`/api/auth/callback?token=${encodeURIComponent(plainToken)}`);
  const loc2 = r2.headers.get('location');
  assert(loc2?.includes('error=invalid'), `Reuse token → error=invalid (got: ${loc2})`);

  // Expired token → error=invalid
  const expiredToken = generateToken();
  const expiredHash = hashToken(expiredToken);
  const pastExpiry = new Date(Date.now() - 1000);
  await sql`
    INSERT INTO auth_magic_links (id, email, token_hash, expires_at)
    VALUES (gen_random_uuid(), ${TEST_EMAIL}, ${expiredHash}, ${pastExpiry.toISOString()})
  `;
  const r3 = await get(`/api/auth/callback?token=${encodeURIComponent(expiredToken)}`);
  const loc3 = r3.headers.get('location');
  assert(loc3?.includes('error=invalid'), `Expired token → error=invalid`);
}

// ─────────────────────────────────────────────
console.log('\n6. App access with session');
// ─────────────────────────────────────────────
{
  // With session cookie → 200
  const r1 = await get('/app', {
    headers: { Cookie: `zb_session=${sessionCookie}` },
  });
  // Next.js layout does DB verify and either serves app or redirects to sign-in
  // With a valid session it should be 200
  assert(r1.status === 200, `GET /app (valid session) → 200`);

  // Verify session in DB
  const tokenHash = hashToken(sessionCookie);
  const sessions = await sql`SELECT id, user_id FROM auth_sessions WHERE token_hash = ${tokenHash}`;
  assert(sessions.length === 1, `Session in DB`);
  assert(sessions[0].user_id === testUserId, `Session links to correct user`);
}

// ─────────────────────────────────────────────
console.log('\n7. Sign-out');
// ─────────────────────────────────────────────
{
  const r1 = await post('/api/auth/sign-out', {}, {
    headers: { Cookie: `zb_session=${sessionCookie}` },
  });
  assert(r1.status === 307 || r1.status === 302, `Sign-out → redirect`);
  const clearedCookie = extractCookie(r1, 'zb_session');
  // Cookie should be cleared (maxAge=0 or empty value)
  const setCookieHeader = r1.headers.getSetCookie?.()?.find(c => c.startsWith('zb_session=')) ?? '';
  assert(setCookieHeader.includes('Max-Age=0') || setCookieHeader.includes('zb_session=;'),
    `zb_session cleared after sign-out`);

  // After sign-out, session should be gone from DB
  const tokenHash = hashToken(sessionCookie);
  const sessions = await sql`SELECT id FROM auth_sessions WHERE token_hash = ${tokenHash}`;
  assert(sessions.length === 0, `Session deleted from DB after sign-out`);

  // /app with old cookie → redirect to /sign-in
  const r2 = await get('/app', {
    headers: { Cookie: `zb_session=${sessionCookie}` },
  });
  assert(r2.status === 307 && r2.headers.get('location')?.includes('/sign-in'),
    `Old session after sign-out → redirect to /sign-in`);
}

// ─────────────────────────────────────────────
console.log('\n8. Revoke user');
// ─────────────────────────────────────────────
let activeSessionCookie;
{
  // Create a new session for the test user
  const plainToken = generateToken();
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await sql`
    INSERT INTO auth_magic_links (id, email, token_hash, expires_at)
    VALUES (gen_random_uuid(), ${TEST_EMAIL}, ${tokenHash}, ${expiresAt.toISOString()})
  `;
  const r = await get(`/api/auth/callback?token=${encodeURIComponent(plainToken)}`);
  activeSessionCookie = extractCookie(r, 'zb_session');
  assert(!!activeSessionCookie, `New session created for revoke test`);

  // Revoke user
  const r2 = await post('/api/admin/users/revoke', { userId: testUserId }, {
    headers: { Cookie: `zb_admin=${adminCookie}` },
  });
  assert(r2.status === 200, `Revoke user → 200`);

  // Verify DB status changed
  const rows = await sql`SELECT status FROM app_users WHERE id = ${testUserId}`;
  assert(rows[0]?.status === 'revoked', `User status = revoked in DB`);

  // Verify sessions deleted
  const sessions = await sql`SELECT id FROM auth_sessions WHERE user_id = ${testUserId}`;
  assert(sessions.length === 0, `All sessions deleted after revoke`);

  // /app with cookie → should redirect to sign-in (session deleted)
  const r3 = await get('/app', {
    headers: { Cookie: `zb_session=${activeSessionCookie}` },
  });
  assert(r3.status === 307 && r3.headers.get('location')?.includes('/sign-in'),
    `Revoked user session → redirect to /sign-in`);
}

// ─────────────────────────────────────────────
console.log('\n9. Cleanup test data');
// ─────────────────────────────────────────────
{
  await sql`DELETE FROM auth_magic_links WHERE email = ${TEST_EMAIL}`;
  await sql`DELETE FROM auth_sessions WHERE user_id = ${testUserId}`;
  await sql`DELETE FROM app_users WHERE id = ${testUserId}`;
  await sql`DELETE FROM organizations WHERE id = ${testOrgId}`;
  console.log(`  Cleaned up test user ${TEST_EMAIL} and org ${testOrgId}`);
}

// ─────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nSome tests FAILED.');
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
}

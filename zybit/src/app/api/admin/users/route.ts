import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db/client';
import { appUsers, organizations } from '@/lib/db/schema';
import { verifyAdminCookie, ADMIN_COOKIE } from '@/lib/auth/adminSession';

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const db = getDb();
  const users = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      organizationId: appUsers.organizationId,
      role: appUsers.role,
      status: appUsers.status,
      createdAt: appUsers.createdAt,
    })
    .from(appUsers)
    .orderBy(appUsers.createdAt);
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let email: string, orgName: string;
  try {
    const body = await request.json() as { email?: unknown; orgName?: unknown };
    if (typeof body.email !== 'string' || !body.email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
    }
    email = body.email.trim().toLowerCase();
    orgName = typeof body.orgName === 'string' && body.orgName.trim()
      ? body.orgName.trim()
      : email;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const db = getDb();

  // Check for duplicate email
  const [existing] = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(eq(appUsers.email, email))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: 'A user with that email already exists.' }, { status: 409 });
  }

  // Create org + user
  const orgId = `org_${randomUUID().replace(/-/g, '')}`;
  const userId = randomUUID();

  await db.insert(organizations).values({ id: orgId, name: orgName }).onConflictDoNothing();
  await db.insert(appUsers).values({
    id: userId,
    email,
    organizationId: orgId,
    role: 'member',
    status: 'approved',
  });

  return NextResponse.json({ userId, orgId, email });
}

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db/client';
import { appUsers } from '@/lib/db/schema';
import { verifyAdminCookie, ADMIN_COOKIE } from '@/lib/auth/adminSession';
import { deleteUserSessions } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let userId: string;
  try {
    const body = await request.json() as { userId?: unknown };
    if (typeof body.userId !== 'string') {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }
    userId = body.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(appUsers)
    .set({ status: 'revoked' })
    .where(eq(appUsers.id, userId));

  await deleteUserSessions(userId);

  return NextResponse.json({ ok: true });
}

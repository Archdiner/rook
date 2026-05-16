import { NextRequest, NextResponse } from 'next/server';
import { mintAdminCookie, adminCookieOptions } from '@/lib/auth/adminSession';

export async function POST(request: NextRequest) {
  let password: string;
  try {
    const body = await request.json() as { password?: unknown };
    password = String(body.password ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const response = NextResponse.redirect(new URL('/admin', request.url));
  response.cookies.set(adminCookieOptions.name, mintAdminCookie(), {
    httpOnly: adminCookieOptions.httpOnly,
    secure: adminCookieOptions.secure,
    sameSite: adminCookieOptions.sameSite,
    path: adminCookieOptions.path,
    maxAge: adminCookieOptions.maxAge,
  });
  return response;
}

import { NextRequest, NextResponse } from 'next/server';
import { consumeMagicLink, sessionCookieOptions } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/sign-in?error=invalid', request.url));
  }

  const sessionToken = await consumeMagicLink(token);

  if (!sessionToken) {
    return NextResponse.redirect(new URL('/sign-in?error=invalid', request.url));
  }

  const response = NextResponse.redirect(new URL('/app', request.url));
  response.cookies.set(sessionCookieOptions.name, sessionToken, {
    httpOnly: sessionCookieOptions.httpOnly,
    secure: sessionCookieOptions.secure,
    sameSite: sessionCookieOptions.sameSite,
    path: sessionCookieOptions.path,
    maxAge: sessionCookieOptions.maxAge,
  });
  return response;
}

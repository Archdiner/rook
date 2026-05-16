import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, SESSION_COOKIE } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);

  const response = NextResponse.redirect(new URL('/sign-in', request.url));
  response.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { handleProxyRequest } from '@/lib/experiments/proxy/handler';
import { isProxyHost } from '@/lib/experiments/proxy/host';

const isPublicRoute = createRouteMatcher([
  '/',
  '/dashboard(.*)',
  '/docs(.*)',
  '/discovery(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/intake',
  '/api/discovery',
  '/api/phase1/health',
  '/api/phase2/health',
  '/api/billing/webhook',
  '/api/loader(.*)',
]);

function isSegmentWebhookPath(pathname: string): boolean {
  return /^\/api\/phase2\/integrations\/[^/]+\/segment-webhook\/?$/.test(pathname);
}

function clerkProtectionEnabled(): boolean {
  return process.env.FORGE_CLERK_ENABLED === '1' && Boolean(process.env.CLERK_SECRET_KEY);
}

export default clerkMiddleware(async (auth, req, event) => {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith('/api/proxy/')) {
    return NextResponse.next();
  }

  if (isProxyHost(req.nextUrl.hostname)) {
    return handleProxyRequest(req, event);
  }

  if (!clerkProtectionEnabled()) {
    return NextResponse.next();
  }

  // Redirect already-authenticated users (with an active org) away from auth
  // pages server-side, before Clerk's client JS can fire its own redirect back
  // to /app — that client redirect is what causes the login flicker loop.
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
    const { userId, orgId } = await auth();
    if (userId && orgId) {
      return NextResponse.redirect(new URL('/app', req.url));
    }
    return NextResponse.next();
  }

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  if (isSegmentWebhookPath(pathname)) {
    const authz = req.headers.get('authorization');
    const hasBearerCred =
      typeof authz === 'string' &&
      /^Bearer\s+\S+/i.test(authz.trim()) &&
      authz.trim().toLowerCase() !== 'bearer';
    if (!hasBearerCred) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SEGMENT_WEBHOOK_UNAUTHORIZED',
            message:
              'Send Authorization: Bearer <token> matching the env var referenced by integration.secretRef.',
          },
        },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  if (pathname === '/api/phase2/cron/sync-posthog') {
    return NextResponse.next();
  }

  const authz = req.headers.get('authorization');
  if (authz?.startsWith('Bearer zybit_sk_')) {
    return NextResponse.next();
  }

  await auth.protect();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};

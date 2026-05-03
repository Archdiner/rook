import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/docs(.*)',
  '/discovery(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/intake',
  '/api/discovery',
  '/api/phase1/health',
  '/api/phase2/health',
]);

function isSegmentWebhookPath(pathname: string): boolean {
  return /^\/api\/phase2\/integrations\/[^/]+\/segment-webhook\/?$/.test(pathname);
}

function clerkProtectionEnabled(): boolean {
  return process.env.FORGE_CLERK_ENABLED === '1' && Boolean(process.env.CLERK_SECRET_KEY);
}

const clerkMw = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname;
  if (isSegmentWebhookPath(pathname)) {
    // Route validates Bearer against integration.secretRef (timing-safe).
    // Reject absent/malformed Authorization here so anonymous clients cannot
    // reach the integration lookup without any credential envelope.
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

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!clerkProtectionEnabled()) {
    return NextResponse.next();
  }
  
  return clerkMw(req, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};


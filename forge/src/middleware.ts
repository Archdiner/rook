import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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

export default clerkMiddleware(async (auth, req) => {
  if (!clerkProtectionEnabled()) {
    return NextResponse.next();
  }

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname;
  if (isSegmentWebhookPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname === '/api/phase2/cron/sync-posthog') {
    return NextResponse.next();
  }

  const authz = req.headers.get('authorization');
  if (authz?.startsWith('Bearer forge_sk_')) {
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

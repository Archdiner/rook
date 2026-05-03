import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  assignBucket,
  bucketCookieMaxAge,
  bucketCookieName,
  generateVisitorId,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
} from '@/lib/experiments/bucketing';
import { applyModifications } from '@/lib/experiments/htmlModifier';
import type { VariantModification } from '@/lib/experiments/types';

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

// ---------------------------------------------------------------------------
// Proxy mode: detect *.zybit.run (prod) or *.localhost:3000 (dev)
// ---------------------------------------------------------------------------

function isProxyHost(hostname: string): boolean {
  return hostname.endsWith('.zybit.run') || hostname.endsWith('.localhost');
}

function extractSlug(hostname: string): string | null {
  if (hostname.endsWith('.zybit.run')) {
    const slug = hostname.slice(0, -'.zybit.run'.length);
    return slug || null;
  }
  if (hostname.endsWith('.localhost')) {
    const slug = hostname.slice(0, -'.localhost'.length);
    return slug || null;
  }
  return null;
}

interface ProxyExperiment {
  id: string;
  targetPath: string | null;
  modifications: VariantModification[];
  controlPct: number;
  durationDays: number;
}

interface ProxyConfig {
  site: { id: string; domain: string };
  experiments: ProxyExperiment[];
}

async function handleProxyRequest(req: NextRequest): Promise<NextResponse> {
  const hostname = req.nextUrl.hostname;
  const slug = extractSlug(hostname);

  if (!slug) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Fetch config from our own API
  const configUrl = new URL(`/api/proxy/config?slug=${encodeURIComponent(slug)}`, req.url);
  const configRes = await fetch(configUrl.toString());
  if (!configRes.ok) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const configJson = (await configRes.json()) as { success: boolean; data?: ProxyConfig };
  if (!configJson.success || !configJson.data) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const { site, experiments } = configJson.data;
  const requestPath = req.nextUrl.pathname;

  // Find experiments matching this path
  const matchingExperiments = experiments.filter(
    (exp) => !exp.targetPath || exp.targetPath === requestPath,
  );

  // No matching experiments -> transparent proxy
  if (matchingExperiments.length === 0) {
    const originUrl = `https://${site.domain}${requestPath}${req.nextUrl.search}`;
    const originRes = await fetch(originUrl, {
      headers: { 'User-Agent': req.headers.get('user-agent') || '' },
      redirect: 'follow',
    });
    return new NextResponse(originRes.body, {
      status: originRes.status,
      headers: originRes.headers,
    });
  }

  // Use first matching experiment (could extend to multi-experiment later)
  const experiment = matchingExperiments[0];

  // Read or generate visitor ID
  let visitorId = req.cookies.get(VISITOR_COOKIE)?.value;
  const isNewVisitor = !visitorId;
  if (!visitorId) {
    visitorId = generateVisitorId();
  }

  // Check for existing bucket cookie
  const existingBucket = req.cookies.get(bucketCookieName(experiment.id))?.value;
  const bucket = existingBucket === 'control' || existingBucket === 'variant'
    ? existingBucket
    : await assignBucket(visitorId, experiment.id, experiment.controlPct);

  // Fetch origin HTML
  const originUrl = `https://${site.domain}${requestPath}${req.nextUrl.search}`;
  const originRes = await fetch(originUrl, {
    headers: { 'User-Agent': req.headers.get('user-agent') || '' },
    redirect: 'follow',
  });

  let response: NextResponse;

  if (bucket === 'variant' && experiment.modifications.length > 0) {
    const contentType = originRes.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const html = await originRes.text();
      const modifiedHtml = applyModifications(html, experiment.modifications);
      response = new NextResponse(modifiedHtml, {
        status: originRes.status,
        headers: {
          'content-type': contentType,
        },
      });
    } else {
      // Non-HTML: pass through
      response = new NextResponse(originRes.body, {
        status: originRes.status,
        headers: originRes.headers,
      });
    }
  } else {
    // Control bucket or no modifications: pass through unchanged
    response = new NextResponse(originRes.body, {
      status: originRes.status,
      headers: originRes.headers,
    });
  }

  // Set cookies
  if (isNewVisitor) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      maxAge: VISITOR_COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    });
  }

  if (!existingBucket) {
    response.cookies.set(bucketCookieName(experiment.id), bucket, {
      maxAge: bucketCookieMaxAge(experiment.durationDays),
      sameSite: 'lax',
      path: '/',
    });
  }

  // Fire assignment log (non-blocking)
  const assignmentUrl = new URL('/api/proxy/assignment', req.url);
  fetch(assignmentUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      experimentId: experiment.id,
      bucket,
      visitorId,
      siteId: site.id,
      path: requestPath,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {
    // Fire-and-forget — ignore errors
  });

  return response;
}

// ---------------------------------------------------------------------------
// Main middleware: proxy mode vs dashboard mode
// ---------------------------------------------------------------------------

export default clerkMiddleware(async (auth, req) => {
  // Proxy mode: *.zybit.run or *.localhost
  if (isProxyHost(req.nextUrl.hostname)) {
    return handleProxyRequest(req);
  }

  // Normal dashboard mode — existing Clerk flow
  if (!clerkProtectionEnabled()) {
    return NextResponse.next();
  }

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname;
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

  // Proxy public routes
  if (pathname.startsWith('/api/proxy/')) {
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

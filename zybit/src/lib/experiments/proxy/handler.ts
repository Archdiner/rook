import { NextRequest, NextFetchEvent, NextResponse } from 'next/server';
import {
  assignBucket,
  bucketCookieMaxAge,
  bucketCookieName,
  generateVisitorId,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  type Bucket,
} from '../bucketing';
import { applyModifications } from '../htmlModifier';
import { loadProxyConfig, type ProxyExperiment } from './config';
import { logAssignment } from './assignmentLog';
import { extractSlug } from './host';

export async function handleProxyRequest(
  req: NextRequest,
  event: NextFetchEvent,
): Promise<NextResponse> {
  const slug = extractSlug(req.nextUrl.hostname);
  if (!slug) return new NextResponse('Not Found', { status: 404 });

  const proxyConfig = await loadProxyConfig(slug, req.url);
  if (!proxyConfig) return new NextResponse('Not Found', { status: 404 });

  const { site, experiments } = proxyConfig;
  const requestPath = req.nextUrl.pathname;
  const userAgent = req.headers.get('user-agent') || '';
  const originUrl = `https://${site.domain}${requestPath}${req.nextUrl.search}`;

  // Most-specific path wins; null targetPath (wildcard) sorts last.
  const matching = experiments
    .filter((exp) => !exp.targetPath || exp.targetPath === requestPath)
    .sort((a, b) => (b.targetPath?.length ?? 0) - (a.targetPath?.length ?? 0));

  if (matching.length === 0) {
    return passthrough(originUrl, userAgent);
  }

  const experiment = matching[0];

  let visitorId = req.cookies.get(VISITOR_COOKIE)?.value;
  const isNewVisitor = !visitorId;
  if (!visitorId) visitorId = generateVisitorId();

  const existingBucket = req.cookies.get(bucketCookieName(experiment.id))?.value;
  const bucket: Bucket =
    existingBucket === 'control' || existingBucket === 'variant'
      ? existingBucket
      : await assignBucket(visitorId, experiment.id, experiment.controlPct);

  const response = await fetchAndMaybeModify(originUrl, userAgent, bucket, experiment);

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

  event.waitUntil(
    logAssignment(req.url, {
      experimentId: experiment.id,
      bucket,
      visitorId,
      siteId: site.id,
      path: requestPath,
      timestamp: new Date().toISOString(),
    }),
  );

  return response;
}

const ORIGIN_TIMEOUT_MS = 10_000;

async function fetchOrigin(originUrl: string, userAgent: string): Promise<Response> {
  return fetch(originUrl, {
    headers: { 'User-Agent': userAgent },
    redirect: 'follow',
    signal: AbortSignal.timeout(ORIGIN_TIMEOUT_MS),
  });
}

async function passthrough(originUrl: string, userAgent: string): Promise<NextResponse> {
  try {
    const originRes = await fetchOrigin(originUrl, userAgent);
    return new NextResponse(originRes.body, {
      status: originRes.status,
      headers: originRes.headers,
    });
  } catch {
    return new NextResponse('Origin unreachable', { status: 502 });
  }
}

// Minimal SPA shell detector: a page with no meaningful text content but a
// single root div is almost certainly client-rendered. See Zybit-103.
function looksLikeSpaShell(html: string): boolean {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return false;
  const bodyText = bodyMatch[1].replace(/<[^>]+>/g, '').trim();
  return bodyText.length < 50 && /<div\s+id=/i.test(html);
}

async function fetchAndMaybeModify(
  originUrl: string,
  userAgent: string,
  bucket: Bucket,
  experiment: ProxyExperiment,
): Promise<NextResponse> {
  let originRes: Response;
  try {
    originRes = await fetchOrigin(originUrl, userAgent);
  } catch {
    // Fail-open on network error or timeout — return 502 rather than a Zybit error.
    return new NextResponse('Origin unreachable', { status: 502 });
  }

  const contentType = originRes.headers.get('content-type') || '';

  // Kill switch: if the experiment was stopped after this config was cached,
  // serve unmodified origin rather than stale variant HTML.
  const shouldModify =
    bucket === 'variant' &&
    experiment.status === 'running' &&
    experiment.modifications.length > 0 &&
    contentType.includes('text/html');

  if (!shouldModify) {
    return new NextResponse(originRes.body, {
      status: originRes.status,
      headers: originRes.headers,
    });
  }

  let html: string;
  try {
    html = await originRes.text();
  } catch {
    // Body read failure — fail-open with a re-fetch of unmodified origin.
    const fallback = await fetchOrigin(originUrl, userAgent).catch(() => null);
    if (!fallback) return new NextResponse('Origin unreachable', { status: 502 });
    return new NextResponse(fallback.body, { status: fallback.status, headers: fallback.headers });
  }

  // Zybit-103: SPA shells won't have the target DOM nodes at request time.
  // Log a warning so operators know HTML modifications won't apply.
  if (looksLikeSpaShell(html)) {
    console.warn('[zybit-proxy] SPA shell detected — modifications may not apply', {
      experimentId: experiment.id,
      originUrl,
    });
  }

  let modified: string;
  try {
    modified = applyModifications(html, experiment.modifications);
  } catch {
    // Modification failed — fail-open by serving the original unmodified HTML.
    const headers = new Headers(originRes.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    return new NextResponse(html, { status: originRes.status, headers });
  }

  // Preserve origin headers (Set-Cookie, Cache-Control, CSP, etc.) but drop
  // the encoding/length headers that no longer match the modified body.
  const responseHeaders = new Headers(originRes.headers);
  responseHeaders.set('content-type', contentType);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  return new NextResponse(modified, {
    status: originRes.status,
    headers: responseHeaders,
  });
}

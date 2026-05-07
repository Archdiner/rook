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

async function passthrough(originUrl: string, userAgent: string): Promise<NextResponse> {
  const originRes = await fetch(originUrl, {
    headers: { 'User-Agent': userAgent },
    redirect: 'follow',
  });
  return new NextResponse(originRes.body, {
    status: originRes.status,
    headers: originRes.headers,
  });
}

async function fetchAndMaybeModify(
  originUrl: string,
  userAgent: string,
  bucket: Bucket,
  experiment: ProxyExperiment,
): Promise<NextResponse> {
  const originRes = await fetch(originUrl, {
    headers: { 'User-Agent': userAgent },
    redirect: 'follow',
  });

  const contentType = originRes.headers.get('content-type') || '';
  const shouldModify =
    bucket === 'variant' &&
    experiment.modifications.length > 0 &&
    contentType.includes('text/html');

  if (!shouldModify) {
    return new NextResponse(originRes.body, {
      status: originRes.status,
      headers: originRes.headers,
    });
  }

  const html = await originRes.text();
  const modified = applyModifications(html, experiment.modifications);

  // Preserve origin headers (Set-Cookie, Cache-Control, CSP, etc.) but drop
  // the encoding/length headers that no longer match the modified body.
  const headers = new Headers(originRes.headers);
  headers.set('content-type', contentType);
  headers.delete('content-encoding');
  headers.delete('content-length');

  return new NextResponse(modified, {
    status: originRes.status,
    headers,
  });
}

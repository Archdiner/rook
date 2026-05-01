import { createPhase1Repository } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  success,
} from '@/app/api/phase1/_shared';
import {
  assertApiKeyHasAnyScope,
  assertApiKeyHasScope,
  resolveZybitActor,
} from '@/lib/auth/actor';
import { assertSiteInOrganization } from '@/lib/auth/tenantScope';
import {
  normalizePathRef,
  runSnapshot,
  SnapshotError,
} from '@/lib/phase2/snapshots';
import type {
  SnapshotErrorCode,
  SnapshotFetchOptions,
  SnapshotRunPathResult,
  SnapshotRunReport,
} from '@/lib/phase2/snapshots/types';

interface RouteContext {
  params: Promise<{ siteId: string }>;
}

const MAX_PATHS_PER_REQUEST = 10;

function parseFetchOptions(input: unknown): Partial<SnapshotFetchOptions> | null {
  if (input == null) return {};
  if (typeof input !== 'object') return null;
  const r = input as Record<string, unknown>;
  const out: Partial<SnapshotFetchOptions> = {};
  if (typeof r.timeoutMs === 'number' && Number.isFinite(r.timeoutMs)) {
    out.timeoutMs = Math.min(Math.max(Math.floor(r.timeoutMs), 1_000), 15_000);
  }
  if (typeof r.userAgent === 'string' && r.userAgent.length > 0 && r.userAgent.length <= 200) {
    out.userAgent = r.userAgent;
  }
  if (typeof r.followRedirects === 'number' && Number.isFinite(r.followRedirects)) {
    out.followRedirects = Math.min(Math.max(Math.floor(r.followRedirects), 0), 10);
  }
  if (typeof r.respectRobots === 'boolean') {
    out.respectRobots = r.respectRobots;
  }
  if (typeof r.maxBytes === 'number' && Number.isFinite(r.maxBytes)) {
    out.maxBytes = Math.min(Math.max(Math.floor(r.maxBytes), 10_000), 5_000_000);
  }
  return out;
}

function buildAbsoluteUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

function classifyError(err: unknown): { code: SnapshotErrorCode; message: string } {
  if (err instanceof SnapshotError) {
    return { code: err.code, message: err.message };
  }
  return { code: 'UNKNOWN', message: err instanceof Error ? err.message : 'unknown error' };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteId } = await context.params;
    if (!siteId) {
      return badRequest('`siteId` is required.');
    }

    const parsed = await parseJsonObject(request);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }

    const actorResult = await resolveZybitActor(request, {
      bodyOrganizationId: parsed.value.organizationId,
      allowQueryFallback: false,
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }
    const scopeErr = assertApiKeyHasScope(actorResult.actor, 'integrations:manage');
    if (scopeErr) return scopeErr;

    const body = parsed.value;
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
    if (!baseUrl) {
      return badRequest('`baseUrl` is required (e.g. "https://example.com").');
    }
    try {
      new URL(baseUrl);
    } catch {
      return badRequest('`baseUrl` must be an absolute URL.');
    }

    const rawPaths = Array.isArray(body.paths) ? body.paths : null;
    if (!rawPaths || rawPaths.length === 0) {
      return badRequest('`paths` must be a non-empty array of path strings.');
    }
    if (rawPaths.length > MAX_PATHS_PER_REQUEST) {
      return badRequest(
        `\`paths\` cannot exceed ${MAX_PATHS_PER_REQUEST} entries per request.`
      );
    }
    const paths: string[] = [];
    for (const p of rawPaths) {
      if (typeof p !== 'string' || p.length === 0) {
        return badRequest('every entry in `paths` must be a non-empty string.');
      }
      paths.push(p);
    }

    const options = parseFetchOptions(body.options);
    if (options === null) {
      return badRequest('`options` must be an object.');
    }

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({
      repository,
      organizationId: actorResult.actor.organizationId,
      siteId,
    });
    if (!siteGate.ok) return siteGate.response;

    const results: SnapshotRunPathResult[] = [];

    for (const rawPath of paths) {
      let absoluteUrl: string;
      try {
        absoluteUrl = buildAbsoluteUrl(baseUrl, rawPath);
      } catch (err) {
        results.push({
          path: rawPath,
          pathRef: null,
          url: '',
          status: 'error',
          errorCode: 'INVALID_URL',
          errorMessage: err instanceof Error ? err.message : 'cannot build url',
        });
        continue;
      }

      try {
        const fetched = await runSnapshot(absoluteUrl, options);
        const pathRef = normalizePathRef(fetched.finalUrl);
        const snapshot = await repository.upsertPageSnapshot({
          organizationId: actorResult.actor.organizationId,
          siteId,
          pathRef,
          url: fetched.finalUrl,
          data: fetched.data,
          fetchedAt: new Date(fetched.data.parsedAt),
        });
        results.push({
          path: rawPath,
          pathRef: snapshot.pathRef,
          url: snapshot.url,
          status: 'ok',
          snapshotId: snapshot.id,
        });
      } catch (err) {
        const { code, message } = classifyError(err);
        results.push({
          path: rawPath,
          pathRef: null,
          url: absoluteUrl,
          status: 'error',
          errorCode: code,
          errorMessage: message,
        });
      }
    }

    const report: SnapshotRunReport = {
      total: results.length,
      succeeded: results.filter((r) => r.status === 'ok').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    };

    return success({ siteId, report });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { siteId } = await context.params;
    if (!siteId) {
      return badRequest('`siteId` is required.');
    }

    const actorResult = await resolveZybitActor(request, { allowQueryFallback: true });
    if (!actorResult.ok) {
      return actorResult.response;
    }
    const scopeErr = assertApiKeyHasAnyScope(actorResult.actor, [
      'integrations:manage',
      'insights:run',
    ]);
    if (scopeErr) return scopeErr;

    const url = new URL(request.url);
    const pathRefParam = url.searchParams.get('pathRef');
    const limitParam = url.searchParams.get('limit');

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({
      repository,
      organizationId: actorResult.actor.organizationId,
      siteId,
    });
    if (!siteGate.ok) return siteGate.response;

    if (pathRefParam) {
      let pathRef: string;
      try {
        pathRef = pathRefParam.startsWith('http')
          ? normalizePathRef(pathRefParam)
          : pathRefParam.startsWith('/')
            ? pathRefParam.replace(/\/$/, '') || '/'
            : `/${pathRefParam}`.replace(/\/$/, '') || '/';
      } catch {
        return badRequest('`pathRef` is not a valid path or URL.');
      }
      const snapshot = await repository.getPageSnapshot({
        organizationId: actorResult.actor.organizationId,
        siteId,
        pathRef,
      });
      if (!snapshot) {
        return success({ siteId, pathRef, snapshot: null });
      }
      return success({ siteId, pathRef: snapshot.pathRef, snapshot });
    }

    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 500) : 100;
    const snapshots = await repository.listPageSnapshots({
      organizationId: actorResult.actor.organizationId,
      siteId,
      limit,
    });
    return success({ siteId, count: snapshots.length, snapshots });
  } catch (error) {
    return mapRouteError(error);
  }
}

export const maxDuration = 60;
export const runtime = 'nodejs';

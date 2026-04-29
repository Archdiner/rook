import { randomUUID } from 'crypto';
import { createPhase1Repository } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  parseString,
  resolveOrganizationContext,
  success,
} from '@/app/api/phase1/_shared';
import type { ConnectorProvider } from '@/lib/phase2/connectors/types';
import { badConfigRequest } from '../_shared';

const VALID_PROVIDERS: ReadonlySet<ConnectorProvider> = new Set([
  'posthog',
  'segment',
  'shopify',
  'ga4',
  'custom',
]);

interface ParsedCreateBody {
  siteId: string;
  provider: ConnectorProvider;
  config: Record<string, unknown>;
  secretRef: string | null;
}

function parseCreateBody(
  body: Record<string, unknown>
): { ok: true; value: ParsedCreateBody } | { ok: false; message: string } {
  const siteId = parseString(body.siteId);
  if (!siteId) return { ok: false, message: '`siteId` is required.' };

  const providerRaw = typeof body.provider === 'string' ? body.provider.toLowerCase() : '';
  if (!VALID_PROVIDERS.has(providerRaw as ConnectorProvider)) {
    return {
      ok: false,
      message: `\`provider\` must be one of: ${Array.from(VALID_PROVIDERS).join(', ')}.`,
    };
  }

  const config =
    body.config && typeof body.config === 'object' && !Array.isArray(body.config)
      ? (body.config as Record<string, unknown>)
      : null;
  if (!config) {
    return { ok: false, message: '`config` must be an object.' };
  }

  const secretRefValue = body.secretRef;
  let secretRef: string | null = null;
  if (typeof secretRefValue === 'string') {
    const trimmed = secretRefValue.trim();
    if (trimmed.length > 0) secretRef = trimmed;
  } else if (secretRefValue != null) {
    return { ok: false, message: '`secretRef` must be a string env var name when provided.' };
  }

  if (providerRaw === 'segment') {
    /**
     * Segment v1 is **webhook ingest** only (`POST .../segment-webhook`).
     * `secretRef` must name an env var holding the shared bearer token callers
     * send as `Authorization: Bearer ...`.
     */
    const writeKeyHint = typeof config.writeKey_env === 'string' ? config.writeKey_env.trim() : '';
    if (!writeKeyHint && !secretRef) {
      return {
        ok: false,
        message:
          'For segment, set `secretRef` to an env var holding the webhook bearer token ' +
          '(you may optionally set `config.writeKey_env` to the same name for documentation only).',
      };
    }
  }

  if (providerRaw === 'posthog') {
    const host = typeof config.host === 'string' ? config.host.trim() : '';
    const projectId =
      typeof config.projectId === 'string'
        ? config.projectId.trim()
        : typeof config.projectId === 'number'
          ? String(config.projectId)
          : '';
    if (!host || !/^https?:\/\//i.test(host)) {
      return { ok: false, message: '`config.host` must be a full http(s) URL for PostHog.' };
    }
    if (!projectId) {
      return { ok: false, message: '`config.projectId` is required for PostHog.' };
    }
    if (!secretRef) {
      return {
        ok: false,
        message:
          '`secretRef` is required for PostHog (env var name holding the personal API key).',
      };
    }
  }

  return {
    ok: true,
    value: {
      siteId,
      provider: providerRaw as ConnectorProvider,
      config,
      secretRef,
    },
  };
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonObject(request);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }

    const orgContext = resolveOrganizationContext(request, {
      bodyOrganizationId: parsed.value.organizationId,
      allowQueryFallback: false,
    });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    const parsedBody = parseCreateBody(parsed.value);
    if (!parsedBody.ok) {
      return badConfigRequest(parsedBody.message);
    }

    const repository = createPhase1Repository();
    const integration = await repository.createIntegration({
      id: randomUUID(),
      organizationId: orgContext.organizationId,
      siteId: parsedBody.value.siteId,
      provider: parsedBody.value.provider,
      config: parsedBody.value.config,
      secretRef: parsedBody.value.secretRef,
      createdAt: new Date().toISOString(),
    });

    return success(integration, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function GET(request: Request) {
  try {
    const orgContext = resolveOrganizationContext(request, { allowQueryFallback: true });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    const url = new URL(request.url);
    const siteId = parseString(url.searchParams.get('siteId')) ?? undefined;
    const providerRaw = parseString(url.searchParams.get('provider'));
    const provider =
      providerRaw && VALID_PROVIDERS.has(providerRaw as ConnectorProvider)
        ? (providerRaw as ConnectorProvider)
        : undefined;

    const repository = createPhase1Repository();
    const items = await repository.listIntegrations({
      organizationId: orgContext.organizationId,
      ...(siteId ? { siteId } : {}),
      ...(provider ? { provider } : {}),
    });

    return success(items);
  } catch (error) {
    return mapRouteError(error);
  }
}

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import {
  forbidden,
  parseOptionalString,
  resolveOrganizationContext,
  unauthorized,
} from '@/app/api/phase1/_shared';

import { validateForgeApiKeyBearer } from './apiKeys';

function isClerkEnforced(): boolean {
  return process.env.FORGE_CLERK_ENABLED === '1' && Boolean(process.env.CLERK_SECRET_KEY);
}

function parseBearerForgeKey(request: Request): string | null {
  const raw = request.headers.get('authorization');
  if (!raw?.toLowerCase().startsWith('bearer ')) return null;
  const token = raw.slice('Bearer '.length).trim();
  if (!token.startsWith('zybit_sk_')) return null;
  return token;
}

function rejectForeignOrg(
  bodyOrganizationId: unknown,
  resolvedOrgId: string
): NextResponse | null {
  const fromBody = parseOptionalString(bodyOrganizationId);
  if (fromBody && fromBody !== resolvedOrgId) {
    return forbidden(
      '`organizationId` in the request does not match the authenticated organization.',
      'ORG_MISMATCH'
    );
  }
  return null;
}

export type ZybitActor =
  | { kind: 'session'; organizationId: string; userId: string }
  | { kind: 'api_key'; organizationId: string; keyId: string; scopes: string[] }
  | { kind: 'dev_header'; organizationId: string };

export async function resolveZybitActor(
  request: Request,
  options?: {
    bodyOrganizationId?: unknown;
    allowQueryFallback?: boolean;
    fallbackOrganizationId?: string;
  }
): Promise<
  { ok: true; actor: ZybitActor } | { ok: false; response: NextResponse }
> {
  const apiToken = parseBearerForgeKey(request);
  if (apiToken) {
    const validated = await validateForgeApiKeyBearer(apiToken);
    if (!validated) {
      return {
        ok: false,
        response: unauthorized('Invalid or revoked Zybit API key.', 'INVALID_API_KEY'),
      };
    }
    const mismatch = rejectForeignOrg(options?.bodyOrganizationId, validated.organizationId);
    if (mismatch) return { ok: false, response: mismatch };
    return {
      ok: true,
      actor: {
        kind: 'api_key',
        organizationId: validated.organizationId,
        keyId: validated.id,
        scopes: validated.scopes,
      },
    };
  }

  if (isClerkEnforced()) {
    const { userId, orgId } = await auth();
    if (!userId) {
      return { ok: false, response: unauthorized('Authentication required.', 'UNAUTHORIZED') };
    }
    if (!orgId) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            error: {
              code: 'ACTIVE_ORG_REQUIRED',
              message:
                'Choose an active organization (Clerk organization switcher) before calling this API.',
            },
          },
          { status: 400 }
        ),
      };
    }
    const mismatch = rejectForeignOrg(options?.bodyOrganizationId, orgId);
    if (mismatch) return { ok: false, response: mismatch };
    return {
      ok: true,
      actor: { kind: 'session', organizationId: orgId, userId },
    };
  }

  const orgContext = resolveOrganizationContext(request, {
    bodyOrganizationId: options?.bodyOrganizationId,
    allowQueryFallback: options?.allowQueryFallback ?? true,
    fallbackOrganizationId: options?.fallbackOrganizationId,
  });
  if (!orgContext.ok) {
    return { ok: false, response: orgContext.response };
  }

  return {
    ok: true,
    actor: { kind: 'dev_header', organizationId: orgContext.organizationId },
  };
}

export function assertApiKeyHasScope(
  actor: ZybitActor,
  scope: string
): NextResponse | null {
  if (actor.kind !== 'api_key') return null;
  if (!actor.scopes.includes(scope)) {
    return unauthorized(`API key is missing required scope: ${scope}.`, 'INSUFFICIENT_SCOPE');
  }
  return null;
}

export function assertApiKeyHasAnyScope(
  actor: ZybitActor,
  scopes: string[]
): NextResponse | null {
  if (actor.kind !== 'api_key') return null;
  const hit = scopes.some((s) => actor.scopes.includes(s));
  if (!hit) {
    return unauthorized(
      `API key must include one of: ${scopes.join(', ')}.`,
      'INSUFFICIENT_SCOPE'
    );
  }
  return null;
}

import { NextResponse } from 'next/server';

import { forbidden, mapRouteError } from '@/app/api/phase1/_shared';
import { revokeForgeApiKey } from '@/lib/auth/apiKeys';
import { resolveForgeActor } from '@/lib/auth/forgeActor';

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: RouteCtx) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'API_KEYS_REQUIRE_POSTGRES', message: 'DATABASE_URL is not set.' },
        },
        { status: 503 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Key id required.' } },
        { status: 400 }
      );
    }

    const actorResult = await resolveForgeActor(request, { allowQueryFallback: false });
    if (!actorResult.ok) {
      return actorResult.response;
    }

    if (actorResult.actor.kind === 'api_key') {
      return forbidden('API keys cannot revoke API keys.', 'API_KEY_FORBIDDEN');
    }

    const revoked = await revokeForgeApiKey({
      organizationId: actorResult.actor.organizationId,
      keyId: id,
    });

    if (!revoked) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'API key not found.' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { revoked: true } });
  } catch (error) {
    return mapRouteError(error);
  }
}

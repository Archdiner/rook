import { NextResponse } from 'next/server';

import {
  badRequest,
  forbidden,
  mapRouteError,
  parseJsonObject,
  parseString,
  success,
} from '@/app/api/phase1/_shared';
import {
  generateForgeApiKeyPlaintext,
  insertForgeApiKeyRow,
} from '@/lib/auth/apiKeys';
import { resolveForgeActor } from '@/lib/auth/forgeActor';

const ALLOWED_SCOPES = new Set(['insights:run', 'events:write', 'integrations:manage']);

function parseScopes(raw: unknown): { ok: true; value: string[] } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: ['integrations:manage', 'insights:run', 'events:write'] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: '`scopes` must be an array of strings when provided.' };
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !ALLOWED_SCOPES.has(item)) {
      return {
        ok: false,
        message: `Each scope must be one of: ${Array.from(ALLOWED_SCOPES).join(', ')}.`,
      };
    }
    out.push(item);
  }
  if (out.length === 0) {
    return { ok: false, message: 'At least one scope is required.' };
  }
  return { ok: true, value: out };
}

/**
 * Create a machine API key (plaintext returned once). Requires interactive session or dev header mode; API keys cannot mint API keys.
 */
export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'API_KEYS_REQUIRE_POSTGRES',
            message: 'API keys are persisted in Postgres; DATABASE_URL is not configured.',
          },
        },
        { status: 503 }
      );
    }

    const parsed = await parseJsonObject(request);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }
    const body = parsed.value;

    const actorResult = await resolveForgeActor(request, {
      bodyOrganizationId: body.organizationId,
      allowQueryFallback: false,
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }

    if (actorResult.actor.kind === 'api_key') {
      return forbidden('API keys cannot create other API keys.', 'API_KEY_FORBIDDEN');
    }

    const name = parseString(body.name);
    if (!name) {
      return badRequest('`name` is required.');
    }

    const scopesParsed = parseScopes(body.scopes);
    if (!scopesParsed.ok) {
      return badRequest(scopesParsed.message);
    }

    const plaintext = generateForgeApiKeyPlaintext();
    const row = await insertForgeApiKeyRow({
      organizationId: actorResult.actor.organizationId,
      name,
      scopes: scopesParsed.value,
      plaintext,
    });

    return success(
      {
        id: row.id,
        name,
        scopes: scopesParsed.value,
        /** Returned once — store securely; only a hash is saved server-side. */
        plaintextKey: plaintext,
      },
      201
    );
  } catch (error) {
    return mapRouteError(error);
  }
}

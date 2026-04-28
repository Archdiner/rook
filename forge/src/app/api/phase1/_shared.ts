import { NextResponse } from 'next/server';
import { MissingBlobTokenError, Phase1StorageError } from '@/lib/phase1/storage';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export function success<T>(data: T, status = 200): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function badRequest(message: string, code = 'BAD_REQUEST'): NextResponse<ApiEnvelope<never>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status: 400 }
  );
}

export function serverError(message = 'Internal server error.'): NextResponse<ApiEnvelope<never>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    },
    { status: 500 }
  );
}

export function mapRouteError(error: unknown): NextResponse<ApiEnvelope<never>> {
  if (error instanceof MissingBlobTokenError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: 503 }
    );
  }

  if (error instanceof Phase1StorageError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: 500 }
    );
  }

  return serverError();
}

export function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function parseString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parsePositiveInt(
  value: string | null,
  defaultValue: number,
  max = 500
): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultValue;
  return Math.min(parsed, max);
}

export async function parseJsonObject(
  request: Request
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const parsed = await request.json();
    const object = asObject(parsed);
    if (!object) {
      return { ok: false, message: 'Request body must be a JSON object.' };
    }
    return { ok: true, value: object };
  } catch {
    return { ok: false, message: 'Request body must be valid JSON.' };
  }
}

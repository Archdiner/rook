import { randomUUID } from 'crypto';
import { appendJsonlRecord, Phase1Site, readJsonlRecords } from '@/lib/phase1/storage';
import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  parseOptionalString,
  parsePositiveInt,
  parseString,
  success,
} from '../_shared';

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonObject(request);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }
    const body = parsed.value;

    const name = parseString(body.name);
    if (!name) {
      return badRequest('`name` is required and must be a non-empty string.');
    }

    const domain = parseString(body.domain);
    if (!domain) {
      return badRequest('`domain` is required and must be a non-empty string.');
    }

    const analyticsProvider = parseOptionalString(body.analyticsProvider);
    const site: Phase1Site = {
      id: randomUUID(),
      name,
      domain: domain.toLowerCase(),
      createdAt: new Date().toISOString(),
      ...(analyticsProvider ? { analyticsProvider } : {}),
    };

    await appendJsonlRecord('sites', site);
    return success(site, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50, 200);
    const sites = await readJsonlRecords<Phase1Site>('sites', { limit, monthsToScan: 6 });
    return success(sites);
  } catch (error) {
    return mapRouteError(error);
  }
}

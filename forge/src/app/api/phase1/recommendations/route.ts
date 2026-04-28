import { Phase1Event, Phase1ReadinessSnapshot, readJsonlRecords } from '@/lib/phase1/storage';
import { badRequest, mapRouteError, parseJsonObject, parseString, success } from '../_shared';

interface Recommendation {
  id: string;
  title: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

function fallbackSufficiency(siteId: string, events: Phase1Event[]): Phase1ReadinessSnapshot {
  const sessions = new Set(events.map((event) => event.sessionId));
  const pages = new Set(events.map((event) => event.path));
  const eventTypes = new Set(events.map((event) => event.type));

  const reasons: string[] = [];
  if (events.length < 25) reasons.push('Need at least 25 events.');
  if (sessions.size < 10) reasons.push('Need at least 10 unique sessions.');
  if (pages.size < 5) reasons.push('Need events across at least 5 paths.');
  if (eventTypes.size < 3) reasons.push('Need at least 3 event types.');

  const scoreParts = [
    Math.min(events.length / 25, 1),
    Math.min(sessions.size / 10, 1),
    Math.min(pages.size / 5, 1),
    Math.min(eventTypes.size / 3, 1),
  ];
  const score = Math.round((scoreParts.reduce((sum, n) => sum + n, 0) / scoreParts.length) * 100);

  const status: Phase1ReadinessSnapshot['status'] =
    score >= 85 ? 'sufficient' : score >= 50 ? 'collecting' : 'insufficient';

  return {
    id: `snapshot-${siteId}-${new Date().toISOString().slice(0, 16)}`,
    siteId,
    score,
    status,
    reasons,
    eventCount: events.length,
    sessionCount: sessions.size,
    generatedAt: new Date().toISOString(),
  };
}

async function computeSnapshot(siteId: string, events: Phase1Event[]): Promise<Phase1ReadinessSnapshot> {
  try {
    const modulePath = '@/lib/phase1/sufficiency';
    const sufficiencyModule = (await import(modulePath)) as {
      computeSufficiencySnapshot?: (args: { siteId: string; events: Phase1Event[] }) => Phase1ReadinessSnapshot;
      computeSufficiency?: (args: { siteId: string; events: Phase1Event[] }) => Phase1ReadinessSnapshot;
    };

    if (typeof sufficiencyModule.computeSufficiencySnapshot === 'function') {
      return sufficiencyModule.computeSufficiencySnapshot({ siteId, events });
    }

    if (typeof sufficiencyModule.computeSufficiency === 'function') {
      return sufficiencyModule.computeSufficiency({ siteId, events });
    }
  } catch {
    // Fall back when sufficiency module is not available in this phase.
  }

  return fallbackSufficiency(siteId, events);
}

function buildRecommendations(snapshot: Phase1ReadinessSnapshot, events: Phase1Event[]): Recommendation[] {
  const pages = new Set(events.map((event) => event.path));
  const eventTypes = new Set(events.map((event) => event.type));
  const sessions = new Set(events.map((event) => event.sessionId));

  const candidates: Recommendation[] = [];

  if (snapshot.status !== 'sufficient') {
    candidates.push({
      id: 'increase-sample-size',
      title: 'Collect a larger event sample',
      rationale: `Current sample is ${snapshot.eventCount} events across ${sessions.size} sessions; target at least 25 events and 10 sessions for stable signals.`,
      priority: 'high',
    });
  }

  if (pages.size < 5) {
    candidates.push({
      id: 'expand-page-coverage',
      title: 'Track more key user journeys',
      rationale: `Events are currently concentrated on ${pages.size} path(s). Instrument high-intent pages to improve recommendation confidence.`,
      priority: 'high',
    });
  }

  if (eventTypes.size < 3) {
    candidates.push({
      id: 'broaden-event-taxonomy',
      title: 'Capture richer event types',
      rationale: `Only ${eventTypes.size} unique event type(s) detected. Add conversions, friction, and intent signals for better prioritization.`,
      priority: 'medium',
    });
  }

  if (snapshot.status === 'sufficient') {
    candidates.push({
      id: 'start-experiment-loop',
      title: 'Start a weekly experiment loop',
      rationale: 'Readiness is sufficient. Ship three evidence-backed UX changes and compare conversion deltas week-over-week.',
      priority: 'medium',
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      id: 'maintain-signal-quality',
      title: 'Maintain tracking consistency',
      rationale: 'Data quality looks healthy. Keep event naming and page coverage stable as traffic scales.',
      priority: 'low',
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return candidates
    .sort((a, b) => rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id))
    .slice(0, 3);
}

async function buildRecommendationsResponse(siteId: string) {
  const events = await readJsonlRecords<Phase1Event>('events', {
    limit: 2000,
    monthsToScan: 6,
    filter: (record) => record.siteId === siteId,
  });

  const snapshot = await computeSnapshot(siteId, events);
  const recommendations = buildRecommendations(snapshot, events);

  return success({
    siteId,
    readiness: snapshot,
    recommendations,
  });
}

function parseSiteIdFromQuery(request: Request): string | null {
  return parseString(new URL(request.url).searchParams.get('siteId'));
}

async function parseSiteIdFromBody(request: Request): Promise<{ siteId: string } | { error: Response }> {
  const parsedBody = await parseJsonObject(request);
  if (!parsedBody.ok) {
    return { error: badRequest(parsedBody.message) };
  }

  const siteId = parseString(parsedBody.value.siteId);
  if (!siteId) {
    return { error: badRequest('`siteId` is required in JSON body.') };
  }

  return { siteId };
}

export async function GET(request: Request) {
  try {
    const siteId = parseSiteIdFromQuery(request);
    if (!siteId) {
      return badRequest('`siteId` query param is required.');
    }

    return await buildRecommendationsResponse(siteId);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsedSiteId = await parseSiteIdFromBody(request);
    if ('error' in parsedSiteId) {
      return parsedSiteId.error;
    }

    return await buildRecommendationsResponse(parsedSiteId.siteId);
  } catch (error) {
    return mapRouteError(error);
  }
}

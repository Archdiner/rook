import { Phase1Event, Phase1ReadinessSnapshot, readJsonlRecords } from '@/lib/phase1/storage';
import { badRequest, mapRouteError, parseString, success } from '../_shared';

interface ReadinessData {
  snapshot: Phase1ReadinessSnapshot;
  totals: {
    eventCount: number;
    sessionCount: number;
    pageCount: number;
    eventTypeCount: number;
  };
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

export async function GET(request: Request) {
  try {
    const siteId = parseString(new URL(request.url).searchParams.get('siteId'));
    if (!siteId) {
      return badRequest('`siteId` query param is required.');
    }

    const events = await readJsonlRecords<Phase1Event>('events', {
      limit: 2000,
      monthsToScan: 6,
      filter: (record) => record.siteId === siteId,
    });

    const snapshot = await computeSnapshot(siteId, events);
    const totals = {
      eventCount: events.length,
      sessionCount: new Set(events.map((event) => event.sessionId)).size,
      pageCount: new Set(events.map((event) => event.path)).size,
      eventTypeCount: new Set(events.map((event) => event.type)).size,
    };

    const payload: ReadinessData = { snapshot, totals };
    return success(payload);
  } catch (error) {
    return mapRouteError(error);
  }
}

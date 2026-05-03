import {
  badRequest,
  parseString,
} from '@/app/api/phase1/_shared';
import type {
  CtaConfig,
  CohortDimensionConfig,
  NarrativeConfig,
  OnboardingStepConfig,
  Phase2SiteConfig,
  TimeWindow,
} from '@/lib/phase2/types';

const VALID_COHORT_SOURCE = new Set<CohortDimensionConfig['source']>([
  'property',
  'metric',
  'path-prefix',
]);

function asString(value: unknown): string | null {
  return parseString(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    const s = asString(item);
    if (!s) return null;
    out.push(s);
  }
  return out;
}

function parseCohortDimension(value: unknown): CohortDimensionConfig | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const id = asString(r.id);
  const label = asString(r.label);
  const source = typeof r.source === 'string' ? (r.source as CohortDimensionConfig['source']) : null;
  if (!id || !label || !source || !VALID_COHORT_SOURCE.has(source)) return null;
  const key = asString(r.key) ?? undefined;
  const fallback = asString(r.fallback) ?? undefined;
  const out: CohortDimensionConfig = { id, label, source };
  if (key) out.key = key;
  if (fallback) out.fallback = fallback;
  return out;
}

function parseOnboardingStep(value: unknown): OnboardingStepConfig | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const id = asString(r.id);
  const label = asString(r.label);
  const order = asNumber(r.order);
  const match = parseEventMatch(r.match);
  if (!id || !label || order === null || !match) return null;
  return { id, label, order, match };
}

function parseEventMatch(value: unknown): OnboardingStepConfig['match'] | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const kind = r.kind;
  if (kind === 'event-type') {
    const type = asString(r.type);
    if (!type) return null;
    return { kind, type };
  }
  if (kind === 'path-prefix') {
    const prefix = asString(r.prefix);
    if (!prefix) return null;
    return { kind, prefix };
  }
  return null;
}

function parseCtaMatch(value: unknown): CtaConfig['match'] | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const kind = r.kind;
  if (kind === 'event-type') {
    const type = asString(r.type);
    if (!type) return null;
    return { kind, type };
  }
  if (kind === 'property-equals') {
    const key = asString(r.key);
    if (!key) return null;
    const raw = r.value;
    if (typeof raw === 'string' || typeof raw === 'boolean') {
      return { kind, key, value: raw };
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return { kind, key, value: raw };
    }
    return null;
  }
  return null;
}

function parseCta(value: unknown): CtaConfig | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const pageRef = asString(r.pageRef);
  const ctaId = asString(r.ctaId);
  const label = asString(r.label);
  const visualWeight = asNumber(r.visualWeight);
  const match = parseCtaMatch(r.match);
  if (!pageRef || !ctaId || !label || visualWeight === null || !match) return null;
  return { pageRef, ctaId, label, visualWeight, match };
}

function parseNarrative(value: unknown): NarrativeConfig | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const id = asString(r.id);
  const label = asString(r.label);
  const sourcePathRef = asString(r.sourcePathRef);
  const expectedPathRefs = asStringArray(r.expectedPathRefs);
  if (!id || !label || !sourcePathRef || !expectedPathRefs) return null;
  return { id, label, sourcePathRef, expectedPathRefs };
}

function parseArrayOf<T>(
  value: unknown,
  parser: (item: unknown) => T | null
): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    const parsed = parser(item);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

export interface ParsedSiteConfigBody {
  cohortDimensions: CohortDimensionConfig[];
  onboardingSteps: OnboardingStepConfig[];
  ctas: CtaConfig[];
  narratives: NarrativeConfig[];
  conversionEventTypes?: string[];
}

export function parsePhase2SiteConfigBody(
  body: Record<string, unknown>
): { ok: true; value: ParsedSiteConfigBody } | { ok: false; message: string } {
  const cohortDimensions = parseArrayOf(body.cohortDimensions, parseCohortDimension);
  if (!cohortDimensions) {
    return {
      ok: false,
      message: '`cohortDimensions` must be an array of {id,label,source,key?,fallback?}.',
    };
  }
  const onboardingSteps = parseArrayOf(body.onboardingSteps, parseOnboardingStep);
  if (!onboardingSteps) {
    return {
      ok: false,
      message: '`onboardingSteps` must be an array of {id,label,order,match}.',
    };
  }
  const ctas = parseArrayOf(body.ctas, parseCta);
  if (!ctas) {
    return {
      ok: false,
      message: '`ctas` must be an array of {pageRef,ctaId,label,visualWeight,match}.',
    };
  }
  const narratives = parseArrayOf(body.narratives, parseNarrative);
  if (!narratives) {
    return {
      ok: false,
      message: '`narratives` must be an array of {id,label,sourcePathRef,expectedPathRefs[]}.',
    };
  }

  let conversionEventTypes: string[] | undefined;
  if (body.conversionEventTypes !== undefined) {
    const list = asStringArray(body.conversionEventTypes);
    if (!list) {
      return {
        ok: false,
        message: '`conversionEventTypes` must be an array of strings when provided.',
      };
    }
    conversionEventTypes = list;
  }

  const value: ParsedSiteConfigBody = {
    cohortDimensions,
    onboardingSteps,
    ctas,
    narratives,
  };
  if (conversionEventTypes) value.conversionEventTypes = conversionEventTypes;
  return { ok: true, value };
}

export function buildSiteConfig(args: {
  siteId: string;
  organizationId: string;
  body: ParsedSiteConfigBody;
  updatedAt?: string;
}): Phase2SiteConfig {
  const { siteId, organizationId, body, updatedAt } = args;
  const config: Phase2SiteConfig = {
    siteId,
    organizationId,
    cohortDimensions: body.cohortDimensions,
    onboardingSteps: body.onboardingSteps,
    ctas: body.ctas,
    narratives: body.narratives,
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
  if (body.conversionEventTypes) {
    config.conversionEventTypes = body.conversionEventTypes;
  }
  return config;
}

export function parseTimeWindow(
  value: unknown
): { ok: true; value: TimeWindow } | { ok: false; message: string } {
  if (!value || typeof value !== 'object') {
    return { ok: false, message: '`window` must be an object with `start` and `end`.' };
  }
  const r = value as Record<string, unknown>;
  const start = parseString(r.start);
  const end = parseString(r.end);
  if (!start || !end) {
    return { ok: false, message: '`window.start` and `window.end` are required.' };
  }
  if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
    return { ok: false, message: '`window.start` and `window.end` must be ISO date strings.' };
  }
  if (Date.parse(end) <= Date.parse(start)) {
    return { ok: false, message: '`window.end` must be strictly after `window.start`.' };
  }
  return { ok: true, value: { start, end } };
}

export function badConfigRequest(message: string) {
  return badRequest(message, 'INVALID_PHASE2_REQUEST');
}

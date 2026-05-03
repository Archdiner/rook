import { describe, it, expect } from 'vitest';
import {
  pct,
  clamp,
  share,
  gini,
  topByCount,
  sanitizeIdSegment,
  round,
  normalizeText,
  groupSessions,
} from '@/lib/phase2/rules/helpers';
import { makeEvent, makePageView } from './fixtures';

describe('pct', () => {
  it('converts 0.73 to "73"', () => {
    expect(pct(0.73)).toBe('73');
  });

  it('converts 0.385 to "38.5"', () => {
    expect(pct(0.385)).toBe('38.5');
  });

  it('converts 0 to "0"', () => {
    expect(pct(0)).toBe('0');
  });

  it('converts 1 to "100"', () => {
    expect(pct(1)).toBe('100');
  });

  it('handles NaN gracefully', () => {
    expect(pct(NaN)).toBe('0');
  });
});

describe('clamp', () => {
  it('clamps below lo', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
  });

  it('clamps above hi', () => {
    expect(clamp(2, 0, 1)).toBe(1);
  });

  it('passes through in-range values', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('handles lo=hi', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it('clamps NaN to lo', () => {
    expect(clamp(NaN, 0, 1)).toBe(0);
  });
});

describe('share', () => {
  it('73/100 = 0.73', () => {
    expect(share(73, 100)).toBe(0.73);
  });

  it('returns null when total=0', () => {
    expect(share(0, 0)).toBeNull();
  });

  it('returns null when total is negative', () => {
    expect(share(5, -1)).toBeNull();
  });

  it('can exceed 1 when count > total', () => {
    expect(share(110, 100)).toBeCloseTo(1.1, 1);
  });
});

describe('gini', () => {
  it('uniform distribution → 0', () => {
    expect(gini([1, 1, 1, 1])).toBe(0);
  });

  it('fully concentrated → approaches 1', () => {
    const g = gini([100, 0, 0, 0]);
    expect(g).toBeGreaterThan(0.5);
  });

  it('empty array → 0', () => {
    expect(gini([])).toBe(0);
  });

  it('all zeros → 0', () => {
    expect(gini([0, 0, 0])).toBe(0);
  });

  it('single value → 0', () => {
    expect(gini([42])).toBe(0);
  });
});

describe('topByCount', () => {
  it('sorts by count descending', () => {
    const items = ['a', 'b', 'a', 'c', 'a', 'b'];
    const result = topByCount(items, (s) => s);
    expect(result[0].key).toBe('a');
    expect(result[0].count).toBe(3);
    expect(result[1].count).toBe(2);
  });

  it('breaks ties alphabetically', () => {
    const items = ['b', 'a', 'b', 'a'];
    const result = topByCount(items, (s) => s);
    expect(result[0].key).toBe('a');
    expect(result[1].key).toBe('b');
  });

  it('handles empty input', () => {
    expect(topByCount([], (s: string) => s)).toEqual([]);
  });

  it('items array contains correct elements', () => {
    const items = ['x', 'y', 'x'];
    const result = topByCount(items, (s) => s);
    const xGroup = result.find((r) => r.key === 'x');
    expect(xGroup?.items).toHaveLength(2);
  });
});

describe('sanitizeIdSegment', () => {
  it('lowercases and replaces non-alphanumerics with dash', () => {
    const result = sanitizeIdSegment('/pricing/plans');
    expect(result).toBe('pricing-plans');
  });

  it('collapses multiple separators', () => {
    const result = sanitizeIdSegment('--Hello  World--');
    expect(result).toBe('hello-world');
  });

  it('returns "_" for empty/degenerate input', () => {
    expect(sanitizeIdSegment('')).toBe('_');
    expect(sanitizeIdSegment('---')).toBe('_');
  });

  it('strips leading and trailing dashes', () => {
    const result = sanitizeIdSegment('-abc-');
    expect(result).toBe('abc');
  });
});

describe('round', () => {
  it('rounds to N decimal places', () => {
    expect(round(3.14159, 2)).toBe(3.14);
  });

  it('returns 0 for NaN', () => {
    expect(round(NaN, 2)).toBe(0);
  });

  it('round(1.5, 0) = 2', () => {
    expect(round(1.5, 0)).toBe(2);
  });
});

describe('normalizeText', () => {
  it('lowercases and trims', () => {
    expect(normalizeText('  Hello World  ')).toBe('hello world');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeText('a   b')).toBe('a b');
  });

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });
});

describe('groupSessions', () => {
  it('groups events by sessionId', () => {
    const events = [
      makePageView('/a', 'session-1'),
      makePageView('/b', 'session-1'),
      makePageView('/a', 'session-2'),
    ];
    const sessions = groupSessions(events);
    expect(sessions).toHaveLength(2);
    const s1 = sessions.find((s) => s.sessionId === 'session-1');
    expect(s1?.events).toHaveLength(2);
  });

  it('excludes unknown_session', () => {
    const events = [
      makeEvent({ sessionId: 'unknown_session', type: 'page_view', path: '/' }),
      makePageView('/a', 'session-real'),
    ];
    const sessions = groupSessions(events);
    expect(sessions.every((s) => s.sessionId !== 'unknown_session')).toBe(true);
  });

  it('sorts events by occurredAt within session', () => {
    const events = [
      makeEvent({
        sessionId: 'sess-x',
        type: 'page_view',
        path: '/b',
        occurredAt: '2026-01-15T12:01:00Z',
      }),
      makeEvent({
        sessionId: 'sess-x',
        type: 'page_view',
        path: '/a',
        occurredAt: '2026-01-15T12:00:00Z',
      }),
    ];
    const sessions = groupSessions(events);
    const [first] = sessions;
    expect(first.events[0].path).toBe('/a');
    expect(first.events[1].path).toBe('/b');
  });

  it('computes distinct paths in arrival order', () => {
    const events = [
      makeEvent({ sessionId: 's1', type: 'page_view', path: '/', occurredAt: '2026-01-15T12:00:00Z' }),
      makeEvent({ sessionId: 's1', type: 'page_view', path: '/pricing', occurredAt: '2026-01-15T12:01:00Z' }),
      makeEvent({ sessionId: 's1', type: 'page_view', path: '/', occurredAt: '2026-01-15T12:02:00Z' }),
    ];
    const sessions = groupSessions(events);
    expect(sessions[0].paths).toEqual(['/', '/pricing', '/']);
  });
});

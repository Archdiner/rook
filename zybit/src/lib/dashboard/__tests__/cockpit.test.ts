import { describe, expect, it } from 'vitest';
import { deriveIntegrationHealth } from '../cockpit';

const NOW = new Date('2026-05-19T12:00:00Z').getTime();

describe('deriveIntegrationHealth', () => {
  it('reports "Zybit is watching" for a recently synced active integration', () => {
    const h = deriveIntegrationHealth(
      { status: 'active', lastSyncedAt: '2026-05-19T11:30:00Z', lastErrorCode: null },
      NOW,
    );
    expect(h.state).toBe('watching');
    expect(h.tone).toBe('green');
    expect(h.label).toBe('Zybit is watching');
  });

  it('reports "No data yet" when never synced', () => {
    const h = deriveIntegrationHealth(
      { status: 'pending', lastSyncedAt: null, lastErrorCode: null },
      NOW,
    );
    expect(h.state).toBe('no-data');
    expect(h.tone).toBe('amber');
  });

  it('reports degraded with the error code when an error is present', () => {
    const h = deriveIntegrationHealth(
      { status: 'error', lastSyncedAt: '2026-05-19T11:30:00Z', lastErrorCode: 'AUTH_FAILED' },
      NOW,
    );
    expect(h.state).toBe('degraded');
    expect(h.tone).toBe('red');
    expect(h.label).toContain('AUTH_FAILED');
  });

  it('reports degraded when the last sync is stale (> 2h)', () => {
    const h = deriveIntegrationHealth(
      { status: 'active', lastSyncedAt: '2026-05-19T08:00:00Z', lastErrorCode: null },
      NOW,
    );
    expect(h.state).toBe('degraded');
    expect(h.label).toContain('stale');
  });

  it('reports disconnected when disabled', () => {
    const h = deriveIntegrationHealth(
      { status: 'disabled', lastSyncedAt: '2026-05-19T11:30:00Z', lastErrorCode: null },
      NOW,
    );
    expect(h.state).toBe('disconnected');
    expect(h.tone).toBe('gray');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IntakeFinding } from '../structuralAudit';

const mockEmailsSend = vi.hoisted(() => vi.fn());

vi.mock('resend', () => {
  class MockResend {
    emails = { send: mockEmailsSend };
  }
  return { Resend: MockResend };
});

process.env.RESEND_API_KEY = 'test-key';

import { emailProspect, emailFoundersFallback } from '../emailProspect';

const baseFinding: IntakeFinding = {
  kind: 'no_h1',
  title: 'No H1 on the page',
  evidence: 'example.com has no H1 heading in its static HTML.',
  prescription: 'Add a single H1 that names the product.',
  confidence: 0.88,
  domain: 'example.com',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('emailProspect', () => {
  it('sends email to the prospect with correct subject', async () => {
    mockEmailsSend.mockResolvedValueOnce({ data: { id: 'msg-1' }, error: null });

    const result = await emailProspect('pm@example.com', baseFinding);

    expect(result.success).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledOnce();

    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.to).toBe('pm@example.com');
    expect(call.subject).toBe('we found something on example.com');
    expect(call.text).toContain('example.com');
    expect(call.text).toContain('No H1 on the page');
    expect(call.text).toContain('calendly.com');
  });

  it('returns success: false when Resend returns an error object', async () => {
    mockEmailsSend.mockResolvedValueOnce({ data: null, error: { message: 'rate limit' } });

    const result = await emailProspect('pm@example.com', baseFinding);
    expect(result.success).toBe(false);
  });

  it('returns success: false when Resend throws', async () => {
    mockEmailsSend.mockRejectedValueOnce(new Error('network down'));

    const result = await emailProspect('pm@example.com', baseFinding);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('network down');
    }
  });
});

describe('emailFoundersFallback', () => {
  it('sends fallback to both founder emails', async () => {
    mockEmailsSend.mockResolvedValueOnce({ data: { id: 'msg-2' }, error: null });

    await emailFoundersFallback('https://spa-app.com', 'SPA detected', 'user@test.com');

    expect(mockEmailsSend).toHaveBeenCalledOnce();
    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.to).toEqual(
      expect.arrayContaining(['asad@getzybit.com', 'jad@getzybit.com']),
    );
    expect(call.subject).toContain('spa-app.com');
    expect(call.text).toContain('SPA detected');
    expect(call.text).toContain('user@test.com');
  });

  it('does not throw even when Resend throws', async () => {
    mockEmailsSend.mockRejectedValueOnce(new Error('resend down'));
    await expect(
      emailFoundersFallback('https://x.com', 'error', 'x@x.com'),
    ).resolves.toBeUndefined();
  });
});

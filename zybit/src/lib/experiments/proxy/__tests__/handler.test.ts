import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { ProxyConfig, ProxyExperiment } from '../config';

vi.mock('../config', () => ({
  loadProxyConfig: vi.fn(),
}));

vi.mock('../assignmentLog', () => ({
  logAssignment: vi.fn(),
}));

import { handleProxyRequest } from '../handler';
import { loadProxyConfig } from '../config';
import { logAssignment } from '../assignmentLog';
import { bucketCookieName, VISITOR_COOKIE } from '../../bucketing';

function makeExperiment(overrides: Partial<ProxyExperiment> = {}): ProxyExperiment {
  return {
    id: 'exp-1',
    targetPath: null,
    modifications: [
      { type: 'element-hide', selector: '.banner' },
      { type: 'text-replace', selector: '.title', text: 'Variant Title' },
    ],
    controlPct: 50,
    durationDays: 14,
    ...overrides,
  };
}

function makeConfig(experiments: ProxyExperiment[]): ProxyConfig {
  return {
    site: { id: 'site-1', domain: 'acme.com' },
    experiments,
  };
}

const HTML_BODY = `<!DOCTYPE html><html><head></head><body><h1 class="title">Original</h1><div class="banner">B</div></body></html>`;

function htmlResponse(body: string = HTML_BODY): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function makeRequest(url: string, cookieHeader?: string): NextRequest {
  const headers = new Headers({ 'user-agent': 'test-agent' });
  if (cookieHeader) headers.set('cookie', cookieHeader);
  return new NextRequest(url, { headers });
}

describe('handleProxyRequest', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns 404 when hostname has no slug', async () => {
    const req = makeRequest('https://zybit.run/');
    const res = await handleProxyRequest(req);
    expect(res.status).toBe(404);
  });

  it('returns 404 when no proxy config exists for slug', async () => {
    vi.mocked(loadProxyConfig).mockResolvedValueOnce(null);
    const res = await handleProxyRequest(makeRequest('https://acme.zybit.run/'));
    expect(res.status).toBe(404);
  });

  it('passes through unmodified when no experiment matches the path', async () => {
    vi.mocked(loadProxyConfig).mockResolvedValueOnce(
      makeConfig([makeExperiment({ targetPath: '/checkout' })]),
    );
    fetchSpy.mockResolvedValueOnce(htmlResponse());

    const res = await handleProxyRequest(makeRequest('https://acme.zybit.run/home'));
    const body = await res.text();
    expect(body).toBe(HTML_BODY);
    expect(logAssignment).not.toHaveBeenCalled();
  });

  it('control bucket passes the origin response through unmodified', async () => {
    // Force control via 100% control split
    vi.mocked(loadProxyConfig).mockResolvedValueOnce(
      makeConfig([makeExperiment({ controlPct: 100 })]),
    );
    fetchSpy.mockResolvedValueOnce(htmlResponse());

    const res = await handleProxyRequest(makeRequest('https://acme.zybit.run/home'));
    const body = await res.text();
    expect(body).toBe(HTML_BODY);
    expect(body).not.toContain('Variant Title');
    // Cookie set for stickiness on the experiment + visitor
    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some((c) => c.includes(VISITOR_COOKIE))).toBe(true);
    expect(setCookie.some((c) => c.includes(bucketCookieName('exp-1')))).toBe(true);
    expect(logAssignment).toHaveBeenCalledOnce();
  });

  it('variant bucket applies modifications to HTML response', async () => {
    vi.mocked(loadProxyConfig).mockResolvedValueOnce(
      makeConfig([makeExperiment({ controlPct: 0 })]),
    );
    fetchSpy.mockResolvedValueOnce(htmlResponse());

    const res = await handleProxyRequest(makeRequest('https://acme.zybit.run/home'));
    const body = await res.text();
    expect(body).toContain('Variant Title');
    expect(body).toContain('.banner { display: none !important; }');
    expect(logAssignment).toHaveBeenCalledOnce();
    expect(vi.mocked(logAssignment).mock.calls[0][1]).toMatchObject({
      experimentId: 'exp-1',
      bucket: 'variant',
      siteId: 'site-1',
      path: '/home',
    });
  });

  it('non-HTML origin response is passed through even for variant bucket', async () => {
    vi.mocked(loadProxyConfig).mockResolvedValueOnce(
      makeConfig([makeExperiment({ controlPct: 0 })]),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response('{"x":1}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await handleProxyRequest(makeRequest('https://acme.zybit.run/api/data'));
    const body = await res.text();
    expect(body).toBe('{"x":1}');
  });

  it('existing bucket cookie is sticky — same value used, no new cookie set', async () => {
    vi.mocked(loadProxyConfig).mockResolvedValueOnce(
      // controlPct=0 would normally yield variant; pin existing cookie to 'control'
      makeConfig([makeExperiment({ controlPct: 0 })]),
    );
    fetchSpy.mockResolvedValueOnce(htmlResponse());

    const cookies = `${VISITOR_COOKIE}=visitor-existing; ${bucketCookieName('exp-1')}=control`;
    const res = await handleProxyRequest(makeRequest('https://acme.zybit.run/home', cookies));
    const body = await res.text();

    expect(body).toBe(HTML_BODY); // sticky control → unmodified
    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some((c) => c.includes(VISITOR_COOKIE))).toBe(false);
    expect(setCookie.some((c) => c.includes(bucketCookieName('exp-1')))).toBe(false);
    expect(vi.mocked(logAssignment).mock.calls[0][1]).toMatchObject({
      visitorId: 'visitor-existing',
      bucket: 'control',
    });
  });

  it('logs assignment with the resolved bucket and visitor', async () => {
    vi.mocked(loadProxyConfig).mockResolvedValueOnce(
      makeConfig([makeExperiment({ controlPct: 0 })]),
    );
    fetchSpy.mockResolvedValueOnce(htmlResponse());

    await handleProxyRequest(makeRequest('https://acme.zybit.run/path?x=1'));
    expect(logAssignment).toHaveBeenCalledOnce();
    const [, event] = vi.mocked(logAssignment).mock.calls[0];
    expect(event).toMatchObject({
      experimentId: 'exp-1',
      bucket: 'variant',
      path: '/path',
      siteId: 'site-1',
    });
    expect(event.visitorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof event.timestamp).toBe('string');
  });
});

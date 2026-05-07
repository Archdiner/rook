import { describe, expect, it } from 'vitest';
import { extractSlug, isProxyHost } from '../host';

describe('isProxyHost', () => {
  it('matches *.zybit.run (prod)', () => {
    expect(isProxyHost('acme.zybit.run')).toBe(true);
    expect(isProxyHost('foo.bar.zybit.run')).toBe(true);
  });

  it('matches *.localhost (dev)', () => {
    expect(isProxyHost('acme.localhost')).toBe(true);
  });

  it('rejects the apex domains and unrelated hosts', () => {
    expect(isProxyHost('zybit.run')).toBe(false);
    expect(isProxyHost('localhost')).toBe(false);
    expect(isProxyHost('acme.com')).toBe(false);
  });
});

describe('extractSlug', () => {
  it('extracts the leftmost label from .zybit.run', () => {
    expect(extractSlug('acme.zybit.run')).toBe('acme');
  });

  it('extracts from .localhost in dev', () => {
    expect(extractSlug('acme.localhost')).toBe('acme');
  });

  it('returns null for non-proxy hosts', () => {
    expect(extractSlug('acme.com')).toBeNull();
    expect(extractSlug('zybit.run')).toBeNull();
  });

  it('returns null when slug is empty', () => {
    expect(extractSlug('.zybit.run')).toBeNull();
  });
});

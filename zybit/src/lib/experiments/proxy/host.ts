const PROD_SUFFIX = '.zybit.run';
const DEV_SUFFIX = '.localhost';

export function isProxyHost(hostname: string): boolean {
  return hostname.endsWith(PROD_SUFFIX) || hostname.endsWith(DEV_SUFFIX);
}

export function extractSlug(hostname: string): string | null {
  if (hostname.endsWith(PROD_SUFFIX)) {
    const slug = hostname.slice(0, -PROD_SUFFIX.length);
    return slug || null;
  }
  if (hostname.endsWith(DEV_SUFFIX)) {
    const slug = hostname.slice(0, -DEV_SUFFIX.length);
    return slug || null;
  }
  return null;
}

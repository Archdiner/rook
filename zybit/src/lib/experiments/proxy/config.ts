import { get } from '@vercel/edge-config';
import type { VariantModification } from '../types';

export interface ProxyExperiment {
  id: string;
  targetPath: string | null;
  modifications: VariantModification[];
  controlPct: number;
  durationDays: number;
}

export interface ProxyConfig {
  site: { id: string; domain: string };
  experiments: ProxyExperiment[];
}

export async function loadProxyConfig(
  slug: string,
  baseUrl: string,
): Promise<ProxyConfig | null> {
  if (process.env.EDGE_CONFIG) {
    try {
      const configMap = await get<{ [slug: string]: ProxyConfig }>('proxyConfigs');
      if (configMap?.[slug]) return configMap[slug];
    } catch {
      // fall through to API
    }
  }

  try {
    const url = new URL(`/api/proxy/config?slug=${encodeURIComponent(slug)}`, baseUrl);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data?: ProxyConfig };
    if (!json.success || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

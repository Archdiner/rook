/**
 * Feature flags for the capture pipeline.
 *
 * Reads from Vercel Edge Config when EDGE_CONFIG is set. Falls back to
 * env var overrides for local development. Flags are read in route
 * handlers / cron, not in lib code, so domain logic stays pure.
 *
 * Initial flags:
 *   capture_v2_enabled  — global kill switch for headless path
 */

export async function isCaptureV2Enabled(): Promise<boolean> {
  if (process.env.EDGE_CONFIG) {
    try {
      const { get } = await import('@vercel/edge-config');
      const flag = await get<boolean>('capture_v2_enabled');
      return flag ?? false;
    } catch {
      // Edge Config unavailable — fall through to env var
    }
  }
  return process.env.CAPTURE_V2_ENABLED === '1';
}

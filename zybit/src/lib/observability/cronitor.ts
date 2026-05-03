/**
 * Cronitor heartbeat helper.
 *
 * Best-effort: never throws, silently no-ops when CRONITOR_API_KEY is unset.
 * URL pattern: https://cronitor.link/p/{apiKey}/{monitorKey}/{state}
 */

type CronitorState = 'run' | 'complete' | 'fail';

export async function cronitorPing(
  monitorKey: string,
  state: CronitorState,
  message?: string
): Promise<void> {
  try {
    const apiKey = process.env.CRONITOR_API_KEY;
    if (!apiKey) return;

    const url = new URL(
      `https://cronitor.link/p/${encodeURIComponent(apiKey)}/${encodeURIComponent(monitorKey)}/${state}`
    );
    if (message) {
      url.searchParams.set('message', message.slice(0, 2000));
    }

    await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort — swallow all errors
  }
}

import { mapRouteError, success } from '@/app/api/phase1/_shared';

export async function GET() {
  try {
    return success({
      module: 'phase2',
      status: 'ok',
      version: 'v1',
      capabilities: {
        rollups: true,
        validationGate: true,
        siteConfig: true,
        canonicalEvents: true,
      },
    });
  } catch (error) {
    return mapRouteError(error);
  }
}

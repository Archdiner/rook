import { auth } from '@clerk/nextjs/server';

type ServerAuthResult =
  | { ok: true; orgId: string; userId: string | null }
  | { ok: false; reason: 'unauthenticated' | 'no_org' };

function isClerkEnabled(): boolean {
  return (
    process.env.FORGE_CLERK_ENABLED === '1' &&
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  );
}

export async function getServerAuth(): Promise<ServerAuthResult> {
  if (!isClerkEnabled()) {
    const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? 'org_default';
    return { ok: true, orgId, userId: null };
  }

  const { userId, orgId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthenticated' };
  if (!orgId) return { ok: false, reason: 'no_org' };
  return { ok: true, orgId, userId };
}

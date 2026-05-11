import { getDb } from '@/lib/db/client';
import { organizations } from '@/lib/db/schema';

export async function getOrCreateOrg(orgId: string, name?: string): Promise<void> {
  const db = getDb();
  await db
    .insert(organizations)
    .values({ id: orgId, name: name ?? orgId })
    .onConflictDoNothing({ target: organizations.id });
}

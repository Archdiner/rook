import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { zybitApiKeys } from '@/lib/db/schema';

const PREFIX = 'zybit_sk_';

export function hashForgeApiKeyPlaintext(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

export async function validateForgeApiKeyBearer(
  plaintext: string
): Promise<{ id: string; organizationId: string; scopes: string[] } | null> {
  if (!plaintext.startsWith(PREFIX)) {
    return null;
  }
  if (!process.env.DATABASE_URL) {
    return null;
  }
  const keyHash = hashForgeApiKeyPlaintext(plaintext);
  const db = getDb();
  const rows = await db
    .select()
    .from(zybitApiKeys)
    .where(and(eq(zybitApiKeys.keyHash, keyHash), isNull(zybitApiKeys.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  await db
    .update(zybitApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(zybitApiKeys.id, row.id));

  return {
    id: row.id,
    organizationId: row.organizationId,
    scopes: row.scopes as string[],
  };
}

export function generateForgeApiKeyPlaintext(): string {
  return `${PREFIX}${randomBytes(32).toString('base64url')}`;
}

export async function insertForgeApiKeyRow(args: {
  organizationId: string;
  name: string;
  scopes: string[];
  plaintext: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const id = randomUUID();
  await db.insert(zybitApiKeys).values({
    id,
    organizationId: args.organizationId,
    name: args.name,
    keyHash: hashForgeApiKeyPlaintext(args.plaintext),
    scopes: args.scopes,
  });
  return { id };
}

export async function revokeForgeApiKey(args: {
  organizationId: string;
  keyId: string;
}): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(zybitApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(zybitApiKeys.id, args.keyId),
        eq(zybitApiKeys.organizationId, args.organizationId),
        isNull(zybitApiKeys.revokedAt)
      )
    )
    .returning({ id: zybitApiKeys.id });
  return rows.length > 0;
}

"use server";

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getServerAuth } from "@/lib/auth/serverAuth";
import { getDb } from "@/lib/db/client";
import { zybitFindings } from "@/lib/db/schema";

const VALID_STATUSES = ["open", "approved", "dismissed", "shipped", "measured"] as const;
type FindingStatus = (typeof VALID_STATUSES)[number];

export async function updateFindingStatusAction(
  findingId: string,
  status: FindingStatus,
): Promise<void> {
  const auth = await getServerAuth();
  if (!auth.ok) redirect("/sign-in");

  if (!VALID_STATUSES.includes(status)) return;

  const db = getDb();
  await db
    .update(zybitFindings)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(zybitFindings.id, findingId),
        eq(zybitFindings.organizationId, auth.orgId),
      )
    );
}

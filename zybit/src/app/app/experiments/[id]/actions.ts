"use server";

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getServerAuth } from "@/lib/auth/serverAuth";
import { getDb } from "@/lib/db/client";
import { zybitExperiments } from "@/lib/db/schema";

const VALID_STATUSES = ["running", "completed", "stopped"] as const;
type ExperimentStatus = (typeof VALID_STATUSES)[number];

export async function updateExperimentStatusAction(
  experimentId: string,
  status: ExperimentStatus,
): Promise<void> {
  const auth = await getServerAuth();
  if (!auth.ok) redirect("/sign-in");

  if (!VALID_STATUSES.includes(status)) return;

  const now = new Date();
  const db = getDb();
  await db
    .update(zybitExperiments)
    .set({
      status,
      completedAt: status === "completed" || status === "stopped" ? now : undefined,
      updatedAt: now,
    })
    .where(
      and(
        eq(zybitExperiments.id, experimentId),
        eq(zybitExperiments.organizationId, auth.orgId),
      )
    );
}

export async function recordResultsAction(
  experimentId: string,
  controlRate: number,
  variantRate: number,
  confidence: number,
  participants: number,
): Promise<void> {
  const auth = await getServerAuth();
  if (!auth.ok) redirect("/sign-in");

  const db = getDb();
  await db
    .update(zybitExperiments)
    .set({
      resultControlRate: controlRate,
      resultVariantRate: variantRate,
      resultConfidence: confidence,
      resultParticipants: participants,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(zybitExperiments.id, experimentId),
        eq(zybitExperiments.organizationId, auth.orgId),
      )
    );
}

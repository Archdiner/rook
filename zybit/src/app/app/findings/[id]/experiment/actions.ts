"use server";

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getServerAuth } from "@/lib/auth/serverAuth";
import { getDb } from "@/lib/db/client";
import { zybitFindings } from "@/lib/db/schema";

const VALID_CHANGE_TYPES = ["copy", "style", "reorder", "remove"] as const;
type ChangeType = (typeof VALID_CHANGE_TYPES)[number];

interface SaveBriefInput {
  findingId: string;
  experimentName: string;
  element: string;
  changeType: ChangeType;
  variantDescription: string;
  primaryMetric: string;
  hypothesis: string;
}

export async function saveExperimentBriefAction(input: SaveBriefInput): Promise<void> {
  const auth = await getServerAuth();
  if (!auth.ok) redirect("/sign-in");

  if (!VALID_CHANGE_TYPES.includes(input.changeType)) return;

  const experimentBrief = {
    experimentName: input.experimentName.trim().slice(0, 200),
    element: input.element.trim().slice(0, 500),
    changeType: input.changeType,
    variantDescription: input.variantDescription.trim(),
    primaryMetric: input.primaryMetric.trim().slice(0, 200),
    hypothesis: input.hypothesis.trim() || null,
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  await db
    .update(zybitFindings)
    .set({ experimentBrief, updatedAt: new Date() })
    .where(
      and(
        eq(zybitFindings.id, input.findingId),
        eq(zybitFindings.organizationId, auth.orgId),
      )
    );

  redirect(`/app/findings/${input.findingId}`);
}

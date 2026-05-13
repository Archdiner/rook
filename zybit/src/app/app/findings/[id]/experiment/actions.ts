"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getServerAuth } from "@/lib/auth/serverAuth";
import { getDb } from "@/lib/db/client";
import { zybitExperiments, zybitFindings } from "@/lib/db/schema";
import type { VariantModification } from "@/lib/experiments/types";

const VALID_CHANGE_TYPES = ["copy", "style", "hide"] as const;
type ChangeType = (typeof VALID_CHANGE_TYPES)[number];

interface SaveBriefInput {
  findingId: string;
  experimentName: string;
  selector: string;
  changeType: ChangeType;
  newValue: string;
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
    selector: input.selector.trim().slice(0, 500),
    changeType: input.changeType,
    newValue: input.newValue.trim(),
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

// ---------------------------------------------------------------------------
// Launch — promotes a saved brief into a live running experiment
// ---------------------------------------------------------------------------

function briefToModifications(
  changeType: ChangeType,
  selector: string,
  newValue: string,
): VariantModification[] {
  if (changeType === "copy") {
    return [{ type: "text-replace", selector, text: newValue }];
  }
  if (changeType === "hide") {
    return [{ type: "element-hide", selector }];
  }
  // style: use css-inject to force the variant visual. newValue may be class names
  // or raw CSS — the PM decides. We store the raw value; the manifest API
  // also surfaces the original brief fields for the client-side script path.
  return [{ type: "css-inject", selector, css: newValue }];
}

export async function launchExperimentAction(findingId: string): Promise<void> {
  const auth = await getServerAuth();
  if (!auth.ok) redirect("/sign-in");

  const db = getDb();

  // Load the finding + brief
  const rows = await db
    .select()
    .from(zybitFindings)
    .where(
      and(
        eq(zybitFindings.id, findingId),
        eq(zybitFindings.organizationId, auth.orgId),
      )
    )
    .limit(1);

  const finding = rows[0];
  if (!finding || !finding.experimentBrief) return;

  const brief = finding.experimentBrief;
  const now = new Date();
  const experimentId = randomUUID();

  await db.insert(zybitExperiments).values({
    id: experimentId,
    organizationId: auth.orgId,
    siteId: finding.siteId,
    findingId: finding.id,
    hypothesis: brief.hypothesis ?? brief.variantDescription,
    primaryMetric: brief.primaryMetric,
    audienceControlPct: 50,
    audienceVariantPct: 50,
    durationDays: 14,
    status: "running",
    targetPath: finding.pathRef ?? null,
    modifications: briefToModifications(brief.changeType, brief.selector, brief.newValue),
    // Store original brief fields so the client-side manifest can serve them directly
    notes: JSON.stringify({
      name: brief.experimentName,
      selector: brief.selector,
      changeType: brief.changeType,
      newValue: brief.newValue,
    }),
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Move finding to shipped
  await db
    .update(zybitFindings)
    .set({ status: "shipped", updatedAt: now })
    .where(eq(zybitFindings.id, findingId));

  redirect(`/app/experiments/${experimentId}`);
}

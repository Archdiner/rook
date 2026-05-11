export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { getServerAuth } from "@/lib/auth/serverAuth";
import { getDb } from "@/lib/db/client";
import { zybitFindings } from "@/lib/db/schema";
import ExperimentBuilderForm from "@/components/app/ExperimentBuilderForm";
import type {
  AuditFindingEvidence,
  AuditFindingPrescription,
} from "@/lib/phase2/rules/types";

// ---------------------------------------------------------------------------
// Default derivation helpers
// ---------------------------------------------------------------------------

type ChangeType = "copy" | "style" | "reorder" | "remove";

function defaultChangeType(category: string): ChangeType {
  if (category === "hierarchy") return "style";
  if (category === "fold") return "reorder";
  return "copy";
}

function defaultPrimaryMetric(category: string, pathRef: string | null): string {
  const page = pathRef ? ` on ${pathRef}` : "";
  if (category === "rage") return `rage_click rate${page}`;
  if (category === "abandonment") return `form_submit rate${page}`;
  if (category === "hierarchy") return `CTA click-through rate${page}`;
  if (category === "bounce") return `bounce rate${page}`;
  return `conversion rate${page}`;
}

function defaultElement(
  category: string,
  evidence: AuditFindingEvidence[],
  pathRef: string | null,
): string {
  if (category === "rage") {
    const target = evidence.find((e) => e.label.toLowerCase().includes("rage target"));
    if (target) return String(target.value);
  }
  if (category === "hierarchy") {
    const clicked = evidence.find((e) => e.label.toLowerCase().includes("most-clicked"));
    if (clicked) return String(clicked.value);
  }
  if (category === "abandonment") {
    return pathRef ? `Signup form on ${pathRef}` : "Signup form";
  }
  return "";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ExperimentBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getServerAuth();
  if (!auth.ok) redirect("/sign-in");

  const { id } = await params;

  const db = getDb();
  const rows = await db
    .select()
    .from(zybitFindings)
    .where(
      and(
        eq(zybitFindings.id, id),
        eq(zybitFindings.organizationId, auth.orgId),
      )
    )
    .limit(1);

  const finding = rows[0];
  if (!finding) notFound();

  // Only accessible when approved + has a prescription
  if (!finding.prescription) redirect(`/app/findings/${id}`);

  const prescription = finding.prescription as AuditFindingPrescription;
  const evidence = (finding.evidence ?? []) as AuditFindingEvidence[];

  const defaults = {
    experimentName: `${finding.title} — Variant B`,
    element: defaultElement(finding.category, evidence, finding.pathRef),
    changeType: defaultChangeType(finding.category),
    variantDescription: prescription.experimentVariantDescription,
    primaryMetric: defaultPrimaryMetric(finding.category, finding.pathRef),
    hypothesis: "",
  };

  const isEditing = !!finding.experimentBrief;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#6B6B6B] mb-6">
        <Link href="/app/findings" className="hover:text-[#111] transition-colors">
          Findings
        </Link>
        <span>/</span>
        <Link href={`/app/findings/${id}`} className="hover:text-[#111] transition-colors">
          {finding.title}
        </Link>
        <span>/</span>
        <span className="text-[#111]">
          {isEditing ? "Edit experiment" : "Create experiment"}
        </span>
      </div>

      <div className="mb-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] mb-1">
          Experiment builder
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111]">
          {isEditing ? "Edit experiment brief" : "Create experiment brief"}
        </h1>
        <p className="text-sm text-[#6B6B6B] mt-2 leading-relaxed">
          This brief describes the A/B variant to run. Share it with your developer
          or paste it directly into your testing platform.
        </p>
      </div>

      <ExperimentBuilderForm
        findingId={id}
        defaults={isEditing && finding.experimentBrief
          ? {
              experimentName: finding.experimentBrief.experimentName,
              element: finding.experimentBrief.element,
              changeType: finding.experimentBrief.changeType,
              variantDescription: finding.experimentBrief.variantDescription,
              primaryMetric: finding.experimentBrief.primaryMetric,
              hypothesis: finding.experimentBrief.hypothesis ?? "",
            }
          : defaults}
      />
    </div>
  );
}

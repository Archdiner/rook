export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";
import Link from "next/link";
import { getServerAuth } from "@/lib/auth/serverAuth";
import { createPhase1Repository } from "@/lib/phase1";
import { getDb } from "@/lib/db/client";
import { zybitFindings } from "@/lib/db/schema";
import RunInsightsButton from "@/components/app/RunInsightsButton";

function timeAgo(isoDate: string | Date): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SEVERITY_STYLES = {
  critical: "bg-red-50 text-red-700 border-red-100",
  warn: "bg-amber-50 text-amber-700 border-amber-100",
  info: "bg-sky-50 text-sky-700 border-sky-100",
} as const;

const STATUS_STYLES = {
  open: "bg-black/[0.05] text-[#6B6B6B]",
  approved: "bg-emerald-50 text-emerald-700",
  dismissed: "bg-black/[0.04] text-[#9B9B9B]",
  shipped: "bg-sky-50 text-sky-700",
  measured: "bg-violet-50 text-violet-700",
} as const;

export default async function FindingsPage() {
  const auth = await getServerAuth();
  if (!auth.ok) redirect("/sign-in");

  const repository = createPhase1Repository();
  const sites = await repository.listSites({ organizationId: auth.orgId, limit: 1 });
  const site = sites[0] ?? null;

  if (!site) redirect("/app/onboarding");

  const db = getDb();
  const findings = await db
    .select()
    .from(zybitFindings)
    .where(
      and(
        eq(zybitFindings.siteId, site.id),
        eq(zybitFindings.organizationId, auth.orgId),
      )
    )
    .orderBy(desc(zybitFindings.priorityScore))
    .limit(100);

  const openCount = findings.filter((f) => f.status === "open").length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] mb-1">
            Findings
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-[#111]">
            {openCount} open finding{openCount !== 1 ? "s" : ""}
          </h1>
        </div>
        <RunInsightsButton siteId={site.id} orgId={auth.orgId} />
      </div>

      {findings.length === 0 ? (
        <div className="bg-white border border-black/[0.05] rounded-2xl p-12 text-center">
          <p className="text-[#6B6B6B] mb-6 leading-relaxed">
            No findings yet. Run the insights pipeline to analyze {site.domain}.
          </p>
          <RunInsightsButton siteId={site.id} orgId={auth.orgId} />
        </div>
      ) : (
        <div className="space-y-2">
          {findings.map((finding) => (
            <Link
              key={finding.id}
              href={`/app/findings/${finding.id}`}
              className="block group"
            >
              <div className="bg-white border border-black/[0.05] rounded-2xl px-5 py-4 transition-all group-hover:-translate-y-0.5 group-hover:shadow-sm">
                <div className="flex items-start gap-3">
                  {/* Priority bar */}
                  <div className="shrink-0 mt-1">
                    <div className="w-1 h-8 rounded-full bg-black/[0.06] overflow-hidden">
                      <div
                        className="w-full rounded-full bg-[#111] transition-all"
                        style={{ height: `${Math.round(finding.priorityScore * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                          SEVERITY_STYLES[finding.severity as keyof typeof SEVERITY_STYLES] ??
                          SEVERITY_STYLES.info
                        }`}
                      >
                        {finding.severity}
                      </span>
                      {finding.pathRef && (
                        <span className="font-mono text-xs text-[#6B6B6B] bg-black/[0.04] px-1.5 py-0.5 rounded">
                          {finding.pathRef}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#111] leading-snug mb-1 truncate">
                      {finding.title}
                    </p>
                    <p className="text-xs text-[#6B6B6B] leading-relaxed line-clamp-2">
                      {finding.summary}
                    </p>
                  </div>

                  {/* Right meta */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        STATUS_STYLES[finding.status as keyof typeof STATUS_STYLES] ??
                        STATUS_STYLES.open
                      }`}
                    >
                      {finding.status}
                    </span>
                    <span className="text-xs text-[#9B9B9B]">
                      {timeAgo(finding.lastSeenAt)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

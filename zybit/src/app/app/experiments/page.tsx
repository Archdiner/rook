export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";
import Link from "next/link";
import { getServerAuth } from "@/lib/auth/serverAuth";
import { createPhase1Repository } from "@/lib/phase1";
import { getDb } from "@/lib/db/client";
import { zybitExperiments, zybitFindings } from "@/lib/db/schema";

function timeAgo(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-black/[0.05] text-[#6B6B6B]",
  running: "bg-emerald-50 text-emerald-700",
  completed: "bg-sky-50 text-sky-700",
  stopped: "bg-black/[0.04] text-[#9B9B9B]",
};

export default async function ExperimentsPage() {
  const auth = await getServerAuth();
  if (!auth.ok) redirect("/sign-in");

  const repository = createPhase1Repository();
  const sites = await repository.listSites({ organizationId: auth.orgId, limit: 1 });
  const site = sites[0] ?? null;
  if (!site) redirect("/app/onboarding");

  const db = getDb();

  const experiments = await db
    .select({
      id: zybitExperiments.id,
      hypothesis: zybitExperiments.hypothesis,
      primaryMetric: zybitExperiments.primaryMetric,
      status: zybitExperiments.status,
      targetPath: zybitExperiments.targetPath,
      findingId: zybitExperiments.findingId,
      notes: zybitExperiments.notes,
      audienceControlPct: zybitExperiments.audienceControlPct,
      durationDays: zybitExperiments.durationDays,
      startedAt: zybitExperiments.startedAt,
      createdAt: zybitExperiments.createdAt,
      resultVariantRate: zybitExperiments.resultVariantRate,
      resultControlRate: zybitExperiments.resultControlRate,
      resultConfidence: zybitExperiments.resultConfidence,
    })
    .from(zybitExperiments)
    .where(
      and(
        eq(zybitExperiments.siteId, site.id),
        eq(zybitExperiments.organizationId, auth.orgId),
      )
    )
    .orderBy(desc(zybitExperiments.createdAt))
    .limit(50);

  // Batch-load linked finding titles
  const findingIds = [...new Set(experiments.map((e) => e.findingId).filter(Boolean))] as string[];
  const findingTitles = new Map<string, string>();
  if (findingIds.length > 0) {
    const findings = await db
      .select({ id: zybitFindings.id, title: zybitFindings.title })
      .from(zybitFindings)
      .where(and(eq(zybitFindings.organizationId, auth.orgId)));
    for (const f of findings) findingTitles.set(f.id, f.title);
  }

  const runningCount = experiments.filter((e) => e.status === "running").length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] mb-1">
            Experiments
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-[#111]">
            {runningCount > 0
              ? `${runningCount} running`
              : experiments.length > 0
              ? "No experiments running"
              : "No experiments yet"}
          </h1>
        </div>
      </div>

      {experiments.length === 0 ? (
        <div className="bg-white border border-black/[0.05] rounded-2xl p-12 text-center">
          <p className="text-[#6B6B6B] mb-4 leading-relaxed">
            Approve a finding, save an experiment brief, then launch it to start testing.
          </p>
          <Link
            href="/app/findings"
            className="inline-block bg-[#111] text-[#FAFAF8] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.08em] hover:opacity-80 transition-opacity"
          >
            View findings
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {experiments.map((exp) => {
            const name = exp.notes
              ? (JSON.parse(exp.notes) as { name?: string }).name ?? exp.hypothesis
              : exp.hypothesis;
            const hasResult = exp.resultVariantRate !== null;

            return (
              <Link key={exp.id} href={`/app/experiments/${exp.id}`} className="block group">
                <div className="bg-white border border-black/[0.05] rounded-2xl px-5 py-4 transition-all group-hover:-translate-y-0.5 group-hover:shadow-sm">
                  <div className="flex items-start gap-4">
                    {/* Running indicator */}
                    <div className="shrink-0 mt-1.5">
                      {exp.status === "running" ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 block animate-pulse" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-black/[0.12] block" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            STATUS_STYLES[exp.status] ?? STATUS_STYLES.draft
                          }`}
                        >
                          {exp.status}
                        </span>
                        {exp.targetPath && (
                          <span className="font-mono text-xs text-[#6B6B6B] bg-black/[0.04] px-1.5 py-0.5 rounded">
                            {exp.targetPath}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-[#111] leading-snug mb-1 truncate">
                        {name}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-[#9B9B9B]">
                        <span>Metric: {exp.primaryMetric}</span>
                        {exp.findingId && findingTitles.has(exp.findingId) && (
                          <>
                            <span>·</span>
                            <span className="truncate">
                              From: {findingTitles.get(exp.findingId)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1.5 ml-2">
                      {hasResult ? (
                        <span className="text-xs font-bold text-[#111]">
                          {exp.resultVariantRate !== null && exp.resultControlRate !== null
                            ? `+${((exp.resultVariantRate - exp.resultControlRate) * 100).toFixed(1)}pp`
                            : "Results recorded"}
                        </span>
                      ) : null}
                      <span className="text-xs text-[#9B9B9B]">
                        {exp.startedAt ? `Started ${timeAgo(exp.startedAt)}` : timeAgo(exp.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

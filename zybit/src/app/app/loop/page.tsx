/**
 * FORGE-090 — The Visible Loop
 *
 * /app/loop — top-level page showing the full optimize cycle for a site.
 *
 * This is the product's most important view:
 *   - The demo that beats "ChatGPT can do this" in 10 seconds
 *   - The renewal story: what was detected, what was tested, what moved
 *   - The visible compound: each cycle tighter than the last
 *
 * Timeline entries (in chronological order):
 *   1. DETECTED — "Zybit detected [finding] on [page]" + evidence summary
 *   2. DEPLOYED — "Experiment launched: [hypothesis]" + traffic split
 *   3. RESULT   — "Variant X% vs Control Y% — +Npp (Z% relative), p=confidence"
 *                 OR "Guardrail breached: [metric]" (if stopped early)
 *                 OR "Inconclusive after N days" (if no significance)
 *   4. LEARNED  — "Signal adjusted: [rule] raised threshold on [page]" (requires Phase 2)
 *
 * Data sources:
 *   - zybit_findings (detection events, evidence)
 *   - zybit_experiments (deployment, hypothesis, dates)
 *   - zybit_experiment_outcomes (results, lift, confidence)
 *
 * TODO: This page is scaffolded. Implement data fetching and rendering below.
 *
 * Implementation checklist:
 *   [ ] 1. Load all findings + linked experiments + outcomes for the current site
 *   [ ] 2. Build a chronological timeline merging detections, deployments, results
 *   [ ] 3. Render each entry type with the correct icon + color (see TODO sections below)
 *   [ ] 4. Add empty state for sites with no completed experiments yet
 *   [ ] 5. Link each entry to the finding/experiment detail page
 *   [ ] 6. Add site selector if org has multiple sites
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq, and, desc } from 'drizzle-orm';
import { getServerAuth } from '@/lib/auth/serverAuth';
import { getDb } from '@/lib/db/client';
import { zybitFindings, zybitExperiments, zybitExperimentOutcomes } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// TODO: Timeline entry types
// ---------------------------------------------------------------------------

type DetectionEntry = {
  kind: 'detection';
  date: Date;
  findingId: string;
  title: string;
  pathRef: string | null;
  severity: string;
  evidenceSummary: string; // one-line: e.g. "42% abandonment rate on /checkout"
};

type DeploymentEntry = {
  kind: 'deployment';
  date: Date;
  experimentId: string;
  findingId: string | null;
  hypothesis: string;
  controlPct: number;
  variantPct: number;
};

type ResultEntry = {
  kind: 'result';
  date: Date;
  experimentId: string;
  result: string; // 'positive' | 'negative' | 'inconclusive'
  liftPct: number | null;
  confidence: number | null;
  controlRate: number | null;
  variantRate: number | null;
  guardrailBreached: string | null;
  participants: number | null;
};

type TimelineEntry = DetectionEntry | DeploymentEntry | ResultEntry;

// ---------------------------------------------------------------------------
// TODO: Data fetching
// ---------------------------------------------------------------------------

async function loadTimeline(
  db: ReturnType<typeof getDb>,
  orgId: string,
  siteId: string,
): Promise<TimelineEntry[]> {
  // TODO: implement this function
  //
  // Step 1: Load all findings for the site
  //   const findings = await db.select().from(zybitFindings)
  //     .where(and(eq(zybitFindings.siteId, siteId), eq(zybitFindings.organizationId, orgId)))
  //     .orderBy(desc(zybitFindings.createdAt));
  //
  // Step 2: Load all experiments linked to those findings + outcomes
  //   const experiments = await db.select().from(zybitExperiments)
  //     .where(and(eq(zybitExperiments.siteId, siteId), eq(zybitExperiments.organizationId, orgId)))
  //     .orderBy(desc(zybitExperiments.createdAt));
  //
  //   const outcomes = await db.select().from(zybitExperimentOutcomes)
  //     .where(eq(zybitExperimentOutcomes.siteId, siteId));
  //
  // Step 3: Build timeline entries
  //   - One DetectionEntry per finding (use finding.createdAt as date)
  //   - One DeploymentEntry per experiment where status != 'draft'
  //     (use experiment.startedAt as date)
  //   - One ResultEntry per outcome (use outcome.concludedAt as date)
  //
  // Step 4: Sort all entries by date ascending, return

  void db; void orgId; void siteId;
  return []; // TODO: replace with real implementation
}

// ---------------------------------------------------------------------------
// TODO: Site selection (if org has multiple sites)
// ---------------------------------------------------------------------------

async function loadSites(
  db: ReturnType<typeof getDb>,
  orgId: string,
): Promise<{ id: string; name: string }[]> {
  // TODO: query phase1_sites where organizationId = orgId
  void db; void orgId;
  return []; // TODO
}

// ---------------------------------------------------------------------------
// TODO: Rendering helpers
// ---------------------------------------------------------------------------

function EntryIcon({ kind }: { kind: TimelineEntry['kind'] }) {
  // TODO: distinct icon per entry type
  // detection: magnifying glass (search)
  // deployment: rocket / play button
  // result: chart bar / checkmark (positive) / x (negative) / dash (inconclusive)
  const icons: Record<TimelineEntry['kind'], string> = {
    detection: '🔍',
    deployment: '🚀',
    result: '📊',
  };
  return <span className="text-lg">{icons[kind]}</span>;
}

function EntryLabel({ entry }: { entry: TimelineEntry }) {
  // TODO: render the entry's primary line of text

  if (entry.kind === 'detection') {
    return (
      <div>
        <Link href={`/app/findings/${entry.findingId}`} className="font-medium hover:underline">
          {entry.title}
        </Link>
        {entry.pathRef && (
          <span className="ml-2 text-[#6B6B6B] text-sm font-mono">{entry.pathRef}</span>
        )}
        <p className="text-sm text-[#6B6B6B] mt-0.5">{entry.evidenceSummary}</p>
      </div>
    );
  }

  if (entry.kind === 'deployment') {
    return (
      <div>
        <Link href={`/app/experiments/${entry.experimentId}`} className="font-medium hover:underline">
          {entry.hypothesis}
        </Link>
        <p className="text-sm text-[#6B6B6B] mt-0.5">
          {entry.controlPct}% control / {entry.variantPct}% variant
        </p>
      </div>
    );
  }

  if (entry.kind === 'result') {
    // TODO: render positive/negative/inconclusive differently
    // positive: green lift badge
    // negative: red lift badge
    // inconclusive: grey badge
    // guardrail breach: orange warning
    const resultColor =
      entry.result === 'positive'
        ? 'text-emerald-700'
        : entry.result === 'negative'
          ? 'text-red-600'
          : 'text-[#6B6B6B]';

    return (
      <div>
        <Link href={`/app/experiments/${entry.experimentId}`} className="font-medium hover:underline">
          Experiment{' '}
          <span className={resultColor}>
            {entry.result === 'positive'
              ? `+${entry.liftPct?.toFixed(1)}pp`
              : entry.result === 'negative'
                ? `${entry.liftPct?.toFixed(1)}pp`
                : 'inconclusive'}
          </span>
        </Link>
        {entry.guardrailBreached && (
          <p className="text-sm text-amber-700 mt-0.5">
            ⚠ Guardrail breached: {entry.guardrailBreached}
          </p>
        )}
        {!entry.guardrailBreached && entry.controlRate !== null && entry.variantRate !== null && (
          <p className="text-sm text-[#6B6B6B] mt-0.5">
            Variant {(entry.variantRate * 100).toFixed(2)}% vs Control{' '}
            {(entry.controlRate * 100).toFixed(2)}%
            {entry.confidence !== null && ` — p=${((1 - entry.confidence) * 100).toFixed(1)}%`}
          </p>
        )}
      </div>
    );
  }

  return null;
}

function dateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LoopPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const auth = await getServerAuth();
  if (!auth.ok) redirect('/sign-in');
  const orgId = (auth as { ok: true; orgId: string; userId: string }).orgId;

  const db = getDb();

  // TODO: replace stub with real site loading and selection
  const sites = await loadSites(db, orgId);
  const sp = await searchParams;
  const siteId = sp.site ?? sites[0]?.id ?? '';

  // TODO: remove this placeholder once loadTimeline is implemented
  const timeline = siteId ? await loadTimeline(db, orgId, siteId) : [];

  const kindLabel: Record<TimelineEntry['kind'], string> = {
    detection: 'Detected',
    deployment: 'Deployed',
    result: 'Result',
  };

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">The Loop</h1>
        <p className="text-[#6B6B6B] text-sm mt-1">
          Every finding detected, every experiment deployed, every result measured.
        </p>
      </div>

      {/* TODO: site selector if sites.length > 1 */}
      {sites.length > 1 && (
        <div className="mb-6">
          {/* TODO: render site selector tabs */}
          <p className="text-sm text-[#6B6B6B]">TODO: site selector</p>
        </div>
      )}

      {timeline.length === 0 ? (
        /* TODO: better empty state — explain what will appear here once experiments run */
        <div className="border border-dashed border-[#E0E0E0] rounded-xl p-12 text-center">
          <p className="text-[#6B6B6B] text-sm">
            {siteId
              ? 'No completed experiments yet. Approve a finding to get started.'
              : 'Connect a site to see your loop.'}
          </p>
          {siteId && (
            <Link
              href="/app/findings"
              className="mt-4 inline-block text-sm font-medium underline"
            >
              View findings →
            </Link>
          )}
        </div>
      ) : (
        /* TODO: render actual timeline */
        <ol className="relative border-l border-[#E8E8E8] ml-3 space-y-8">
          {timeline.map((entry, i) => (
            <li key={i} className="ml-6">
              <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-white border border-[#E8E8E8] rounded-full">
                <EntryIcon kind={entry.kind} />
              </span>
              <div className="flex items-start gap-4">
                <div className="min-w-[90px] text-xs text-[#9B9B9B] pt-0.5 shrink-0">
                  {dateLabel(entry.date)}
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#9B9B9B] mb-1 block">
                    {kindLabel[entry.kind]}
                  </span>
                  <EntryLabel entry={entry} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

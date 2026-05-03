"use client";

/**
 * FORGE-067/069 — Experiments list
 *
 * All experiments for a site: status, metric, confidence progress, days running.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const CREAM = "#FAFAF8";
const INK = "#111111";
const MUTED = "#6B6B6B";
const HAIRLINE = "rgba(0,0,0,0.08)";
const SUBTLE = "rgba(0,0,0,0.04)";

type Experiment = {
  id: string;
  findingId: string | null;
  hypothesis: string;
  primaryMetric: string;
  primaryMetricSource: string;
  audienceControlPct: number;
  audienceVariantPct: number;
  durationDays: number;
  status: string;
  externalUrl: string | null;
  resultControlRate: number | null;
  resultVariantRate: number | null;
  resultConfidence: number | null;
  resultParticipants: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

type StatusFilter = "all" | "draft" | "running" | "completed" | "stopped";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    draft:     { bg: SUBTLE,                       fg: MUTED },
    running:   { bg: "rgba(5,150,105,0.10)",       fg: "#065F46" },
    completed: { bg: "rgba(37,99,235,0.10)",       fg: "#1E40AF" },
    stopped:   { bg: "rgba(154,31,42,0.10)",       fg: "#7F1D1D" },
  };
  const { bg, fg } = map[status] ?? { bg: SUBTLE, fg: MUTED };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      background: bg, color: fg, textTransform: "capitalize" as const,
    }}>
      {status}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.min(100, confidence * 100);
  const color = pct >= 95 ? "#16A34A" : pct >= 70 ? "#D97706" : INK;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: MUTED }}>Confidence</span>
        <span style={{ fontSize: 11, fontWeight: 600, color }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: HAIRLINE, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

const STATUS_FILTERS: StatusFilter[] = ["all", "running", "draft", "completed", "stopped"];

function ExperimentsContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("siteId") ?? "";

  const clerkEnabled = useMemo(() => process.env.NEXT_PUBLIC_FORGE_CLERK_ENABLED === "true", []);
  const defaultOrg = useMemo(() => process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "org_default", []);

  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const apiFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers((init?.headers as Record<string, string> | undefined) ?? {});
      if (!clerkEnabled) headers.set("x-org-id", defaultOrg);
      return fetch(input, { ...init, credentials: clerkEnabled ? "include" : "same-origin", headers });
    },
    [clerkEnabled, defaultOrg]
  );

  useEffect(() => {
    async function load() {
      if (!siteId) { setLoading(false); return; }
      try {
        const res = await apiFetch(`/api/dashboard/experiments?siteId=${siteId}`);
        const json = await res.json() as { success?: boolean; data?: unknown };
        if (json.success && Array.isArray(json.data)) {
          setExperiments(json.data as Experiment[]);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [siteId, apiFetch]);

  const filtered = experiments.filter(
    (e) => statusFilter === "all" || e.status === statusFilter
  );

  const counts = STATUS_FILTERS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === "all" ? experiments.length : experiments.filter((e) => e.status === s).length;
    return acc;
  }, {});

  return (
    <div style={{
      padding: "32px clamp(24px, 4vw, 48px)",
      maxWidth: 900,
      color: INK,
      fontFamily: "var(--font-inter), system-ui, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
            Zybit — Experiments
          </p>
          <h1 style={{ margin: 0, fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, letterSpacing: "-0.03em" }}>
            Experiments
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>
            Track A/B tests and measure production impact. Approve a finding to create one.
          </p>
        </div>
        <Link
          href={`/dashboard/findings?siteId=${siteId}`}
          style={{
            display: "inline-block",
            padding: "9px 18px",
            borderRadius: 999,
            border: `1px solid ${HAIRLINE}`,
            fontSize: 13,
            textDecoration: "none",
            color: INK,
            fontWeight: 500,
            background: "#fff",
            whiteSpace: "nowrap",
          }}
        >
          ← Findings
        </Link>
      </div>

      {/* Status filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${statusFilter === s ? INK : HAIRLINE}`,
              background: statusFilter === s ? INK : "#fff",
              color: statusFilter === s ? CREAM : MUTED,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {s} {counts[s] > 0 ? `(${counts[s]})` : ""}
          </button>
        ))}
      </div>

      {!siteId && (
        <div style={{ background: "#fff", border: `1px solid ${HAIRLINE}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 15, color: MUTED }}>Select a site from the cockpit to view experiments.</p>
        </div>
      )}

      {siteId && loading && <p style={{ fontSize: 14, color: MUTED }}>Loading experiments…</p>}

      {siteId && !loading && filtered.length === 0 && (
        <div style={{ background: "#fff", border: `1px solid ${HAIRLINE}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>No experiments yet.</p>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: MUTED }}>
            Approve a finding from the backlog, then click &ldquo;Start measuring&rdquo; to create an experiment.
          </p>
          <Link
            href={`/dashboard/findings?siteId=${siteId}`}
            style={{
              display: "inline-block",
              padding: "9px 22px",
              borderRadius: 999,
              border: "none",
              background: INK,
              color: CREAM,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Go to findings →
          </Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((e) => {
            // eslint-disable-next-line react-hooks/purity
            const nowMs = Date.now();
            const daysElapsed = e.startedAt
              ? Math.floor((nowMs - new Date(e.startedAt).getTime()) / 86_400_000)
              : 0;
            const lift = e.resultControlRate && e.resultVariantRate
              ? ((e.resultVariantRate - e.resultControlRate) / e.resultControlRate) * 100
              : null;

            return (
              <Link
                key={e.id}
                href={`/dashboard/experiments/${e.id}?siteId=${siteId}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{
                  background: "#fff",
                  border: `1px solid ${HAIRLINE}`,
                  borderRadius: 14,
                  padding: "18px 20px",
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                        <StatusPill status={e.status} />
                        <span style={{ fontSize: 11, color: MUTED }}>
                          {e.primaryMetric} via {e.primaryMetricSource}
                        </span>
                        {e.externalUrl && (
                          <span style={{ fontSize: 11, color: "#1E40AF" }}>external link added</span>
                        )}
                      </div>
                      <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.35 }}>
                        {e.hypothesis}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
                        {e.status === "running"
                          ? `Day ${daysElapsed} of ${e.durationDays} · ${e.audienceControlPct}/${e.audienceVariantPct} split`
                          : e.status === "draft"
                          ? "Not started · set up and start when ready"
                          : `${e.status} · ${e.resultParticipants ? `${e.resultParticipants.toLocaleString()} participants` : ""}`}
                      </p>
                    </div>

                    <div style={{ minWidth: 120, display: "flex", flexDirection: "column", gap: 6 }}>
                      {e.resultConfidence !== null ? (
                        <>
                          <ConfidenceBar confidence={e.resultConfidence} />
                          {lift !== null && (
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: lift > 0 ? "#065F46" : "#7F1D1D", textAlign: "right" }}>
                              {lift > 0 ? "+" : ""}{lift.toFixed(1)}% lift
                            </p>
                          )}
                        </>
                      ) : (
                        <p style={{ margin: 0, fontSize: 12, color: MUTED, textAlign: "right" }}>
                          {e.status === "running" ? "Awaiting results" : "No data yet"}
                        </p>
                      )}
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

export default function ExperimentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: MUTED, fontSize: 14, fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Loading…</div>}>
      <ExperimentsContent />
    </Suspense>
  );
}

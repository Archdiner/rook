"use client";

/**
 * FORGE-067/069 — Experiment detail + lift visualization
 *
 * Shows hypothesis, metric, control vs variant conversion rates,
 * statistical confidence meter, participants, and actions.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";

const CREAM = "#FAFAF8";
const INK = "#111111";
const MUTED = "#6B6B6B";
const HAIRLINE = "rgba(0,0,0,0.08)";
const SUBTLE = "rgba(0,0,0,0.04)";

type Experiment = {
  id: string;
  siteId: string;
  findingId: string | null;
  hypothesis: string;
  primaryMetric: string;
  primaryMetricSource: string;
  audienceControlPct: number;
  audienceVariantPct: number;
  durationDays: number;
  status: string;
  externalUrl: string | null;
  externalProvider: string | null;
  notes: string | null;
  resultControlRate: number | null;
  resultVariantRate: number | null;
  resultConfidence: number | null;
  resultParticipants: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  finding?: {
    id: string;
    title: string;
    severity: string;
    pathRef: string | null;
  } | null;
};

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
      display: "inline-block", padding: "3px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
      background: bg, color: fg, textTransform: "capitalize" as const,
    }}>
      {status}
    </span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${HAIRLINE}`,
      borderRadius: 14,
      padding: "20px 22px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: MUTED }}>
      {children}
    </p>
  );
}

/** Visual confidence meter — a single growing arc represented as a progress bar with labels. */
function ConfidenceMeter({ confidence }: { confidence: number }) {
  const pct = Math.min(100, confidence * 100);
  const thresholds = [{ at: 95, label: "significant" }, { at: 70, label: "trending" }];
  const currentLabel = pct >= 95 ? "Statistically significant" : pct >= 70 ? "Trending" : "Insufficient data";
  const color = pct >= 95 ? "#16A34A" : pct >= 70 ? "#D97706" : MUTED;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color }}>
          {pct.toFixed(0)}%
        </span>
        <span style={{ fontSize: 13, color, fontWeight: 600 }}>{currentLabel}</span>
      </div>

      {/* Bar track */}
      <div style={{ position: "relative", height: 8, borderRadius: 999, background: HAIRLINE, overflow: "visible", marginBottom: 6 }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width 0.5s ease" }} />
        {/* Threshold markers */}
        {thresholds.map(({ at }) => (
          <div key={at} style={{
            position: "absolute",
            top: -3,
            left: `${at}%`,
            width: 2,
            height: 14,
            background: "rgba(0,0,0,0.2)",
            borderRadius: 1,
            transform: "translateX(-50%)",
          }} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {thresholds.map(({ at, label }) => (
          <span key={at} style={{ fontSize: 11, color: MUTED }}>
            {at}% = {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar comparison — control vs variant. */
function ConversionComparison({
  controlRate,
  variantRate,
  controlPct,
  variantPct,
}: {
  controlRate: number;
  variantRate: number;
  controlPct: number;
  variantPct: number;
}) {
  const max = Math.max(controlRate, variantRate, 0.01);
  const lift = ((variantRate - controlRate) / controlRate) * 100;
  const liftPos = lift > 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {[
        { label: `Control (${controlPct}%)`, rate: controlRate, isControl: true },
        { label: `Variant (${variantPct}%)`, rate: variantRate, isControl: false },
      ].map(({ label, rate, isControl }) => (
        <div key={label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {(rate * 100).toFixed(2)}%
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: HAIRLINE, overflow: "hidden" }}>
            <div
              style={{
                width: `${(rate / max) * 100}%`,
                height: "100%",
                borderRadius: 999,
                background: isControl ? "rgba(0,0,0,0.25)" : INK,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      ))}

      <div style={{
        padding: "12px 16px",
        borderRadius: 10,
        background: liftPos ? "rgba(5,150,105,0.08)" : "rgba(154,31,42,0.08)",
        border: `1px solid ${liftPos ? "rgba(5,150,105,0.20)" : "rgba(154,31,42,0.20)"}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: liftPos ? "#065F46" : "#7F1D1D" }}>
          {liftPos ? "+" : ""}{lift.toFixed(1)}%
        </span>
        <span style={{ fontSize: 13, color: MUTED }}>
          {liftPos ? "lift" : "decrease"} vs control
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results editor (manual entry for now — later via webhook)
// ---------------------------------------------------------------------------
function ResultsEditor({
  exp,
  onSave,
}: {
  exp: Experiment;
  onSave: (patch: Partial<Experiment>) => void;
}) {
  const [controlRate, setControlRate] = useState(String((exp.resultControlRate ?? 0) * 100));
  const [variantRate, setVariantRate] = useState(String((exp.resultVariantRate ?? 0) * 100));
  const [confidence, setConfidence] = useState(String((exp.resultConfidence ?? 0) * 100));
  const [participants, setParticipants] = useState(String(exp.resultParticipants ?? ""));

  function save() {
    onSave({
      resultControlRate: parseFloat(controlRate) / 100 || null,
      resultVariantRate: parseFloat(variantRate) / 100 || null,
      resultConfidence: parseFloat(confidence) / 100 || null,
      resultParticipants: parseInt(participants, 10) || null,
    });
  }

  return (
    <Card>
      <SectionLabel>Update results</SectionLabel>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
        Enter numbers from your analytics provider. Future versions will pull these automatically via webhook.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        {[
          { label: "Control conversion (%)", value: controlRate, set: setControlRate },
          { label: "Variant conversion (%)", value: variantRate, set: setVariantRate },
          { label: "Statistical confidence (%)", value: confidence, set: setConfidence },
          { label: "Total participants", value: participants, set: setParticipants },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
            <input
              type="number"
              value={value}
              onChange={(e) => set(e.target.value)}
              step="0.01"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 12px",
                borderRadius: 10,
                border: `1px solid ${HAIRLINE}`,
                background: "#fff",
                fontSize: 13,
                color: INK,
              }}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        style={{
          padding: "9px 18px",
          borderRadius: 999,
          border: "none",
          background: INK,
          color: CREAM,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Save results
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function ExperimentDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const siteId = searchParams.get("siteId") ?? "";

  const clerkEnabled = useMemo(() => process.env.NEXT_PUBLIC_FORGE_CLERK_ENABLED === "true", []);
  const defaultOrg = useMemo(() => process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "org_default", []);

  const [exp, setExp] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const apiFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers((init?.headers as Record<string, string> | undefined) ?? {});
      if (!clerkEnabled) headers.set("x-org-id", defaultOrg);
      if (!headers.has("Content-Type") && init?.method && !["GET", "HEAD"].includes(init.method) && init.body) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(input, { ...init, credentials: clerkEnabled ? "include" : "same-origin", headers });
    },
    [clerkEnabled, defaultOrg]
  );

  useEffect(() => {
    async function load() {
      if (!params.id) return;
      try {
        const res = await apiFetch(`/api/dashboard/experiments/${params.id}`);
        const json = await res.json() as { success?: boolean; data?: Experiment };
        if (json.success && json.data) setExp(json.data);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.id, apiFetch]);

  async function patch(update: Record<string, unknown>) {
    if (!exp) return;
    setActionPending(true);
    setActionMsg("");
    try {
      const res = await apiFetch(`/api/dashboard/experiments/${exp.id}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      });
      const json = await res.json() as { success?: boolean; data?: Experiment };
      if (json.success && json.data) {
        setExp(json.data);
        setActionMsg("Saved.");
      }
    } finally {
      setActionPending(false);
    }
  }

  if (loading) return <div style={{ padding: 48, color: MUTED, fontSize: 14, fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Loading…</div>;
  if (!exp) return <div style={{ padding: 48, fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Experiment not found.</div>;

  const daysElapsed = exp.startedAt
    ? Math.floor((Date.now() - new Date(exp.startedAt).getTime()) / 86_400_000)
    : 0;
  const hasResults = exp.resultControlRate !== null && exp.resultVariantRate !== null;
  const hasConfidence = exp.resultConfidence !== null;

  return (
    <div style={{
      padding: "32px clamp(24px, 4vw, 48px)",
      maxWidth: 760,
      color: INK,
      fontFamily: "var(--font-inter), system-ui, sans-serif",
    }}>
      {/* Back */}
      <Link
        href={`/dashboard/experiments?siteId=${siteId}`}
        style={{ fontSize: 13, color: MUTED, textDecoration: "none", display: "inline-block", marginBottom: 20 }}
      >
        ← Back to experiments
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <StatusPill status={exp.status} />
          <span style={{ fontSize: 11, color: MUTED }}>
            {exp.primaryMetric} via {exp.primaryMetricSource}
          </span>
          {exp.startedAt && (
            <span style={{ fontSize: 11, color: MUTED }}>
              Day {daysElapsed} of {exp.durationDays}
            </span>
          )}
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.3 }}>
          {exp.hypothesis}
        </h1>
        {exp.finding && (
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
            From finding:{" "}
            <Link
              href={`/dashboard/findings/${exp.finding.id}?siteId=${siteId}`}
              style={{ color: INK, fontWeight: 500 }}
            >
              {exp.finding.title}
            </Link>
            {exp.finding.pathRef && ` · ${exp.finding.pathRef}`}
          </p>
        )}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {/* Confidence meter */}
        {hasConfidence && (
          <Card>
            <SectionLabel>Statistical confidence</SectionLabel>
            <ConfidenceMeter confidence={exp.resultConfidence!} />
            {exp.resultParticipants && (
              <p style={{ margin: "12px 0 0", fontSize: 13, color: MUTED }}>
                {exp.resultParticipants.toLocaleString()} total participants
              </p>
            )}
          </Card>
        )}

        {/* Control vs Variant */}
        {hasResults && (
          <Card>
            <SectionLabel>Control vs variant — {exp.primaryMetric}</SectionLabel>
            <ConversionComparison
              controlRate={exp.resultControlRate!}
              variantRate={exp.resultVariantRate!}
              controlPct={exp.audienceControlPct}
              variantPct={exp.audienceVariantPct}
            />
          </Card>
        )}

        {/* Setup details */}
        <Card>
          <SectionLabel>Setup</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "Audience split", value: `${exp.audienceControlPct}% control / ${exp.audienceVariantPct}% variant` },
              { label: "Planned duration", value: `${exp.durationDays} days` },
              { label: "Primary metric", value: `${exp.primaryMetric} (${exp.primaryMetricSource})` },
              { label: "Started", value: exp.startedAt ? new Date(exp.startedAt).toLocaleDateString() : "Not started" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ margin: "0 0 3px", fontSize: 11, color: MUTED, letterSpacing: "0.04em" }}>{label}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{value}</p>
              </div>
            ))}
          </div>
          {exp.notes && (
            <p style={{ margin: "14px 0 0", fontSize: 13, color: MUTED, lineHeight: 1.6, paddingTop: 14, borderTop: `1px solid ${HAIRLINE}` }}>
              {exp.notes}
            </p>
          )}
        </Card>

        {/* External link */}
        {exp.externalUrl ? (
          <Card>
            <SectionLabel>External experiment</SectionLabel>
            <a
              href={exp.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "9px 18px",
                borderRadius: 999,
                border: `1px solid ${HAIRLINE}`,
                fontSize: 13,
                color: INK,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              View in {exp.externalProvider ?? "external tool"} →
            </a>
          </Card>
        ) : null}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {exp.status === "draft" && (
            <button
              type="button"
              disabled={actionPending}
              onClick={() => void patch({ status: "running" })}
              style={{
                padding: "10px 22px", borderRadius: 999, border: "none",
                background: INK, color: CREAM, fontSize: 14, fontWeight: 600,
                cursor: actionPending ? "not-allowed" : "pointer",
              }}
            >
              Start experiment
            </button>
          )}
          {exp.status === "running" && (
            <>
              <button
                type="button"
                disabled={actionPending}
                onClick={() => void patch({ status: "completed" })}
                style={{
                  padding: "10px 22px", borderRadius: 999, border: "none",
                  background: INK, color: CREAM, fontSize: 14, fontWeight: 600,
                  cursor: actionPending ? "not-allowed" : "pointer",
                }}
              >
                Mark complete
              </button>
              <button
                type="button"
                disabled={actionPending}
                onClick={() => void patch({ status: "stopped" })}
                style={{
                  padding: "10px 22px", borderRadius: 999,
                  border: `1px solid ${HAIRLINE}`, background: "transparent",
                  fontSize: 14, color: MUTED,
                  cursor: actionPending ? "not-allowed" : "pointer",
                }}
              >
                Stop
              </button>
            </>
          )}
          {actionMsg && <span style={{ fontSize: 13, color: MUTED }}>{actionMsg}</span>}
        </div>

        {/* Results editor */}
        {(exp.status === "running" || exp.status === "completed") && (
          <ResultsEditor
            exp={exp}
            onSave={(patch) => void (async () => {
              setActionPending(true);
              try {
                const res = await apiFetch(`/api/dashboard/experiments/${exp.id}`, {
                  method: "PATCH",
                  body: JSON.stringify(patch),
                });
                const json = await res.json() as { success?: boolean; data?: Experiment };
                if (json.success && json.data) setExp(json.data);
              } finally {
                setActionPending(false);
              }
            })()}
          />
        )}
      </div>
    </div>
  );
}

export default function ExperimentDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: MUTED, fontSize: 14, fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Loading…</div>}>
      <ExperimentDetailContent />
    </Suspense>
  );
}

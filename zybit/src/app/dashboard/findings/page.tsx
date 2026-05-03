"use client";

/**
 * FORGE-065 — Ranked findings backlog
 *
 * Full list of persisted audit findings for a site, sorted by priority.
 * Inline approve/dismiss without navigating away. Click title to see detail.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const CREAM = "#FAFAF8";
const INK = "#111111";
const MUTED = "#6B6B6B";
const HAIRLINE = "rgba(0,0,0,0.08)";
const SUBTLE = "rgba(0,0,0,0.04)";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Finding = {
  id: string;
  ruleId: string;
  category: string;
  severity: string;
  confidence: number;
  priorityScore: number;
  pathRef: string | null;
  title: string;
  summary: string;
  recommendation: string[];
  evidence: Array<{ label: string; value: string | number; context?: string }>;
  status: string;
  previewUrl: string | null;
  lastSeenAt: string;
};

type StatusFilter = "all" | "open" | "approved" | "dismissed" | "shipped" | "measured";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function severityColor(sev: string): { bg: string; fg: string } {
  switch (sev?.toLowerCase()) {
    case "critical": return { bg: "rgba(154,31,42,0.10)", fg: "#7F1D1D" };
    case "warn":     return { bg: "rgba(146,64,14,0.10)", fg: "#78350F" };
    default:         return { bg: "rgba(6,78,59,0.10)",   fg: "#065F46" };
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const { bg, fg } = severityColor(severity);
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.06em",
      background: bg,
      color: fg,
      textTransform: "uppercase" as const,
    }}>
      {severity}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    open:      { bg: SUBTLE,                       fg: INK },
    approved:  { bg: "rgba(37,99,235,0.10)",       fg: "#1E40AF" },
    dismissed: { bg: "rgba(0,0,0,0.06)",           fg: MUTED },
    shipped:   { bg: "rgba(5,150,105,0.10)",       fg: "#065F46" },
    measured:  { bg: "rgba(109,40,217,0.10)",      fg: "#5B21B6" },
  };
  const { bg, fg } = map[status] ?? map.open;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.04em",
      background: bg,
      color: fg,
      textTransform: "capitalize" as const,
    }}>
      {status}
    </span>
  );
}

const STATUS_FILTERS: StatusFilter[] = ["all", "open", "approved", "dismissed", "shipped", "measured"];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function FindingsContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("siteId") ?? "";

  const clerkEnabled = useMemo(() => process.env.NEXT_PUBLIC_FORGE_CLERK_ENABLED === "true", []);
  const defaultOrg = useMemo(() => process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "org_default", []);

  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState("");
  const [monthlyRevCents, setMonthlyRevCents] = useState<number | null>(null);

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

  async function loadFindings() {
    if (!siteId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [res, statusRes] = await Promise.all([
        apiFetch(`/api/dashboard/findings?siteId=${siteId}`),
        apiFetch(`/api/dashboard/status?siteId=${siteId}`),
      ]);
      const statusJson = await statusRes.json() as { success?: boolean; data?: { revenue?: { monthlyRevenueCents?: number | null } } };
      if (statusJson.success && statusJson.data?.revenue?.monthlyRevenueCents) {
        setMonthlyRevCents(statusJson.data.revenue.monthlyRevenueCents);
      }
      const json = await res.json() as { success?: boolean; data?: unknown };
      if (json.success && Array.isArray(json.data)) {
        setFindings(json.data as Finding[]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadFindings(); }, [siteId]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  async function runSync() {
    if (!siteId) return;
    setSyncLoading(true);
    setSyncMsg("");
    try {
      const res = await apiFetch("/api/dashboard/findings", {
        method: "POST",
        body: JSON.stringify({ siteId, days: 7 }),
      });
      const json = await res.json() as {
        success?: boolean;
        data?: { synced?: number; trustworthy?: boolean; findings?: Finding[] };
      };
      if (json.success && json.data?.findings) {
        setFindings(json.data.findings);
        setSyncMsg(`Synced ${json.data.synced ?? 0} findings · gate: ${json.data.trustworthy ? "trustworthy" : "not met"}`);
      }
    } finally {
      setSyncLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setActionPending(id);
    try {
      const res = await apiFetch(`/api/dashboard/findings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const json = await res.json() as { success?: boolean; data?: Finding };
      if (json.success && json.data) {
        setFindings((prev) => prev.map((f) => (f.id === id ? (json.data as Finding) : f)));
      }
    } finally {
      setActionPending(null);
    }
  }

  const filtered = findings.filter(
    (f) => statusFilter === "all" || f.status === statusFilter
  );

  const counts = STATUS_FILTERS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === "all" ? findings.length : findings.filter((f) => f.status === s).length;
    return acc;
  }, {});

  return (
    <div style={{
      padding: "32px clamp(24px, 4vw, 48px)",
      maxWidth: 900,
      color: INK,
      fontFamily: "var(--font-inter), system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 24,
      }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
            Zybit — Findings
          </p>
          <h1 style={{ margin: 0, fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, letterSpacing: "-0.03em" }}>
            Findings backlog
          </h1>
          {siteId && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>
              {findings.length} total · sorted by priority
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void runSync()}
          disabled={!siteId || syncLoading}
          style={{
            padding: "9px 18px",
            borderRadius: 999,
            border: "none",
            background: syncLoading ? "#555" : INK,
            color: CREAM,
            fontSize: 13,
            fontWeight: 600,
            cursor: syncLoading || !siteId ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {syncLoading ? "Running audit…" : "Run audit"}
        </button>
      </div>

      {syncMsg && (
        <p style={{
          marginBottom: 16,
          fontSize: 13,
          color: MUTED,
          padding: "10px 14px",
          background: SUBTLE,
          borderRadius: 10,
          border: `1px solid ${HAIRLINE}`,
        }}>
          {syncMsg}
        </p>
      )}

      {/* Status filter tabs */}
      <div style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        marginBottom: 20,
      }}>
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

      {/* No site */}
      {!siteId && (
        <div style={{
          background: "#fff",
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 14,
          padding: "48px 24px",
          textAlign: "center",
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>No site selected.</p>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
            Select a site from the cockpit to view findings.
          </p>
        </div>
      )}

      {/* Loading */}
      {siteId && loading && (
        <p style={{ fontSize: 14, color: MUTED }}>Loading findings…</p>
      )}

      {/* Empty state */}
      {siteId && !loading && filtered.length === 0 && (
        <div style={{
          background: "#fff",
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 14,
          padding: "48px 24px",
          textAlign: "center",
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>
            No {statusFilter !== "all" ? statusFilter : ""} findings yet.
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: MUTED }}>
            {statusFilter === "open"
              ? "Run an audit to discover what to fix first."
              : `No findings with status "${statusFilter}".`}
          </p>
          {statusFilter === "open" && (
            <button
              type="button"
              onClick={() => void runSync()}
              disabled={syncLoading}
              style={{
                padding: "9px 18px",
                borderRadius: 999,
                border: `1px solid ${HAIRLINE}`,
                background: "transparent",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                color: INK,
              }}
            >
              Run audit
            </button>
          )}
        </div>
      )}

      {/* Findings list */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map((f) => (
            <div
              key={f.id}
              style={{
                background: "#fff",
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 14,
                padding: "16px 18px",
                opacity: f.status === "dismissed" ? 0.55 : 1,
                transition: "opacity 0.2s",
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
              }}>
                {/* Left: title + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginBottom: 5,
                  }}>
                    <SeverityBadge severity={f.severity} />
                    <StatusPill status={f.status} />
                    <span style={{ fontSize: 11, color: MUTED }}>
                      {f.pathRef ?? "site-wide"} · {f.category}
                    </span>
                    {f.previewUrl && (
                      <span style={{
                        fontSize: 11,
                        color: "#1E40AF",
                        padding: "1px 7px",
                        borderRadius: 999,
                        background: "rgba(37,99,235,0.08)",
                      }}>
                        preview added
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/findings/${f.id}?siteId=${siteId}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <p style={{
                      margin: "0 0 4px",
                      fontSize: 15,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.35,
                      cursor: "pointer",
                    }}>
                      {f.title}
                    </p>
                  </Link>
                  <p style={{
                    margin: 0,
                    fontSize: 13,
                    color: MUTED,
                    lineHeight: 1.5,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  } as React.CSSProperties}>
                    {f.summary}
                  </p>
                </div>

                {/* Right: score + actions */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    {monthlyRevCents ? (
                      <>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "#7F1D1D" }}>
                          ~${Math.round((monthlyRevCents / 100) * f.priorityScore * f.confidence).toLocaleString()}/mo
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: MUTED, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          at risk
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
                          {(f.priorityScore * 100).toFixed(0)}
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: MUTED, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          priority
                        </p>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Link
                      href={`/dashboard/findings/${f.id}?siteId=${siteId}`}
                      style={{
                        display: "inline-block",
                        padding: "5px 12px",
                        borderRadius: 999,
                        border: `1px solid ${HAIRLINE}`,
                        fontSize: 12,
                        textDecoration: "none",
                        color: INK,
                        fontWeight: 500,
                        background: "#fff",
                      }}
                    >
                      Detail →
                    </Link>
                    {f.status === "open" && (
                      <>
                        <button
                          type="button"
                          disabled={actionPending === f.id}
                          onClick={() => void updateStatus(f.id, "approved")}
                          style={{
                            padding: "5px 12px",
                            borderRadius: 999,
                            border: "none",
                            background: INK,
                            color: CREAM,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: actionPending === f.id ? "not-allowed" : "pointer",
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actionPending === f.id}
                          onClick={() => void updateStatus(f.id, "dismissed")}
                          style={{
                            padding: "5px 12px",
                            borderRadius: 999,
                            border: `1px solid ${HAIRLINE}`,
                            background: "transparent",
                            fontSize: 12,
                            color: MUTED,
                            cursor: actionPending === f.id ? "not-allowed" : "pointer",
                          }}
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                    {f.status === "approved" && (
                      <Link
                        href={`/dashboard/findings/${f.id}?siteId=${siteId}#measure`}
                        style={{
                          display: "inline-block",
                          padding: "5px 12px",
                          borderRadius: 999,
                          border: "none",
                          background: INK,
                          color: CREAM,
                          textDecoration: "none",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Start measuring →
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Evidence strip (collapsed inline) */}
              {f.evidence && f.evidence.length > 0 && f.status !== "dismissed" && (
                <div style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: `1px solid ${HAIRLINE}`,
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                }}>
                  {f.evidence.slice(0, 3).map((ev, idx) => (
                    <div key={idx}>
                      <p style={{ margin: 0, fontSize: 11, color: MUTED, letterSpacing: "0.04em" }}>
                        {ev.label}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                        {typeof ev.value === "number"
                          ? ev.value < 1 && ev.value > 0
                            ? `${(ev.value * 100).toFixed(1)}%`
                            : ev.value.toFixed(ev.value < 10 ? 1 : 0)
                          : ev.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FindingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: MUTED, fontSize: 14, fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Loading…</div>}>
      <FindingsContent />
    </Suspense>
  );
}

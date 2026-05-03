"use client";

/**
 * FORGE-011 / FORGE-065 — Improver Cockpit
 *
 * Single-site overview: integration health, job status, top findings,
 * active experiments. The "what should I do today?" view.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import WelcomeState from "@/components/dashboard/WelcomeState";

// ---------------------------------------------------------------------------
// Design tokens (matches site brand)
// ---------------------------------------------------------------------------
const CREAM = "#FAFAF8";
const INK = "#111111";
const MUTED = "#6B6B6B";
const HAIRLINE = "rgba(0,0,0,0.08)";
const SUBTLE = "rgba(0,0,0,0.04)";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Integration = {
  id: string;
  provider: string;
  status: string;
  lastSyncedAt: string | null;
  lastErrorCode: string | null;
};

type SiteMini = { id: string; name: string; domain: string };

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
  status: string;
  lastSeenAt: string;
};

type Experiment = {
  id: string;
  hypothesis: string;
  primaryMetric: string;
  status: string;
  startedAt: string | null;
  durationDays: number;
  resultConfidence: number | null;
};

type SiteStatus = {
  pipeline: {
    eventCount7d: number;
    sessionCount7d: number;
    lastSync: string | null;
    healthy: boolean;
    integrations: Array<{
      id: string;
      provider: string;
      status: string;
      lastSyncedAt: string | null;
      lastErrorCode: string | null;
    }>;
  };
  gate: {
    trustworthy: boolean;
    blockCount: number;
    warnCount: number;
    warnings: Array<{ code: string; level: string; message: string }>;
  };
  revenue: {
    monthlyRevenueCents: number | null;
    avgOrderValueCents: number | null;
  } | null;
  openFindings: number;
  readinessPercent: number;
};

function revenueAtRisk(
  monthlyRevenueCents: number,
  priorityScore: number,
  confidence: number
): number {
  // Conservative estimate: monthly revenue × how much of the funnel is affected × confidence
  return Math.round((monthlyRevenueCents / 100) * priorityScore * confidence);
}

function fmtRevenue(dollars: number): string {
  if (dollars >= 10000) return `$${(dollars / 1000).toFixed(0)}k`;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function severityColor(sev: string): { bg: string; fg: string } {
  switch (sev?.toLowerCase()) {
    case "critical":
      return { bg: "rgba(154,31,42,0.10)", fg: "#7F1D1D" };
    case "warn":
      return { bg: "rgba(146,64,14,0.10)", fg: "#78350F" };
    default:
      return { bg: "rgba(6,78,59,0.10)", fg: "#065F46" };
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const { bg, fg } = severityColor(severity);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        background: bg,
        color: fg,
        textTransform: "uppercase",
      }}
    >
      {severity}
    </span>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: ok ? "#16A34A" : "#DC2626",
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Card shell
// ---------------------------------------------------------------------------
function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 14,
        padding: "20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: accent ? INK : INK,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>{sub}</p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main cockpit (uses search params → needs Suspense wrapper)
// ---------------------------------------------------------------------------
function CockpitContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const clerkEnabled = useMemo(
    () => process.env.NEXT_PUBLIC_FORGE_CLERK_ENABLED === "true",
    []
  );
  const defaultOrg = useMemo(
    () => process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "org_default",
    []
  );

  // Site state
  const [sites, setSites] = useState<SiteMini[]>([]);
  const [siteId, setSiteId] = useState(searchParams.get("siteId") ?? "");

  // Data state
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [trustworthy, setTrustworthy] = useState<boolean | null>(null);
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);

  // Loading state
  const [loadingPhase, setLoadingPhase] = useState<"boot" | "syncing" | "idle" | "error">("boot");
  const [syncMsg, setSyncMsg] = useState("");

  const apiFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(
        (init?.headers as Record<string, string> | undefined) ?? {}
      );
      if (!clerkEnabled) headers.set("x-org-id", defaultOrg);
      if (
        !headers.has("Content-Type") &&
        init?.method &&
        !["GET", "HEAD"].includes(init.method) &&
        init.body
      ) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(input, {
        ...init,
        credentials: clerkEnabled ? "include" : "same-origin",
        headers,
      });
    },
    [clerkEnabled, defaultOrg]
  );

  // Boot: load sites
  useEffect(() => {
    async function boot() {
      try {
        const res = await apiFetch("/api/phase1/sites");
        const json = await res.json() as { success?: boolean; data?: unknown };
        let list: SiteMini[] = [];
        if (json.success && Array.isArray(json.data)) {
          list = (json.data as Array<Record<string, unknown>>)
            .filter((s) => typeof s.id === "string")
            .map((s) => ({
              id: String(s.id),
              name: typeof s.name === "string" ? s.name : String(s.id),
              domain: typeof s.domain === "string" ? s.domain : "",
            }));
        }
        setSites(list);
        const paramSite = searchParams.get("siteId");
        const initial =
          paramSite && list.some((s) => s.id === paramSite)
            ? paramSite
            : list[0]?.id ?? "";
        setSiteId(initial);
        setLoadingPhase(initial ? "idle" : "idle");
      } catch {
        setLoadingPhase("error");
      }
    }
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When siteId changes, load integrations + cached findings + experiments
  useEffect(() => {
    if (!siteId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("siteId", siteId);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });

    async function loadData() {
      const [intRes, findRes, expRes, statusRes] = await Promise.allSettled([
        apiFetch(`/api/phase2/integrations?siteId=${siteId}`),
        apiFetch(`/api/dashboard/findings?siteId=${siteId}`),
        apiFetch(`/api/dashboard/experiments?siteId=${siteId}`),
        apiFetch(`/api/dashboard/status?siteId=${siteId}`),
      ]);

      if (intRes.status === "fulfilled" && intRes.value.ok) {
        const json = await intRes.value.json() as { success?: boolean; data?: unknown };
        if (json.success && Array.isArray(json.data)) {
          setIntegrations(json.data as Integration[]);
        }
      }

      if (findRes.status === "fulfilled" && findRes.value.ok) {
        const json = await findRes.value.json() as { success?: boolean; data?: unknown };
        if (json.success && Array.isArray(json.data)) {
          setFindings(json.data as Finding[]);
        }
      }

      if (expRes.status === "fulfilled" && expRes.value.ok) {
        const json = await expRes.value.json() as { success?: boolean; data?: unknown };
        if (json.success && Array.isArray(json.data)) {
          setExperiments(json.data as Experiment[]);
        }
      }

      if (statusRes.status === "fulfilled" && statusRes.value.ok) {
        const json = await statusRes.value.json() as { success?: boolean; data?: unknown };
        if (json.success && json.data) {
          setSiteStatus(json.data as SiteStatus);
        }
      }
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function runSync() {
    if (!siteId) return;
    setLoadingPhase("syncing");
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
      if (json.success && json.data) {
        setFindings((json.data.findings ?? []) as Finding[]);
        setTrustworthy(json.data.trustworthy ?? null);
        setSyncMsg(
          `Found ${json.data.synced ?? 0} finding${(json.data.synced ?? 0) !== 1 ? "s" : ""}. Gate: ${json.data.trustworthy ? "trustworthy" : "not met"}.`
        );
      } else {
        setSyncMsg("Audit ran but returned no findings.");
      }
    } catch {
      setSyncMsg("Audit failed — check API connection.");
    } finally {
      setLoadingPhase("idle");
    }
  }

  const openFindings = findings.filter((f) => f.status === "open");
  const topFindings = openFindings.slice(0, 3);
  const activeExperiments = experiments.filter((e) => e.status === "running");

  const healthyIntegrations = integrations.filter(
    (i) => i.status === "active" && !i.lastErrorCode
  );
  const lastSync = integrations
    .map((i) => i.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  const monthlyRevCents = siteStatus?.revenue?.monthlyRevenueCents ?? null;
  const totalRiskDollars = monthlyRevCents
    ? openFindings.reduce(
        (sum, f) => sum + revenueAtRisk(monthlyRevCents, f.priorityScore, f.confidence),
        0
      )
    : null;

  return (
    <div
      style={{
        padding: "32px clamp(24px, 4vw, 48px)",
        maxWidth: 1100,
        color: INK,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            Zybit — Cockpit
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(22px, 3vw, 28px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
            }}
          >
            {sites.find((s) => s.id === siteId)?.domain ||
              sites.find((s) => s.id === siteId)?.name ||
              "Overview"}
          </h1>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Site selector */}
          {sites.length > 1 && (
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${HAIRLINE}`,
                background: "#fff",
                fontSize: 13,
                color: INK,
                cursor: "pointer",
              }}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.domain || s.name}
                </option>
              ))}
            </select>
          )}

          {/* Run audit */}
          <button
            type="button"
            onClick={() => void runSync()}
            disabled={!siteId || loadingPhase === "syncing"}
            style={{
              padding: "9px 18px",
              borderRadius: 999,
              border: "none",
              background: loadingPhase === "syncing" ? "#555" : INK,
              color: CREAM,
              fontSize: 13,
              fontWeight: 600,
              cursor: loadingPhase === "syncing" || !siteId ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loadingPhase === "syncing" ? "Running audit…" : "Run audit"}
          </button>
        </div>
      </div>

      {syncMsg && (
        <p
          style={{
            marginBottom: 20,
            fontSize: 13,
            color: MUTED,
            padding: "10px 14px",
            background: SUBTLE,
            borderRadius: 10,
            border: `1px solid ${HAIRLINE}`,
          }}
        >
          {syncMsg}
          {trustworthy === false && (
            <span style={{ color: "#92400E", marginLeft: 8 }}>
              Data volume too low for full confidence — collect more events and re-run.
            </span>
          )}
        </p>
      )}

      {/* No sites state */}
      {sites.length === 0 && loadingPhase !== "boot" && (
        <Card style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 600 }}>
            No sites connected yet.
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: MUTED }}>
            Connect your first site to start seeing improvements.
          </p>
          <Link
            href="/dashboard/connect"
            style={{
              display: "inline-block",
              padding: "10px 22px",
              borderRadius: 999,
              background: INK,
              color: CREAM,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Connect a site →
          </Link>
        </Card>
      )}

      {/* Welcome state: site connected + integration exists + no findings + gate not met */}
      {siteId &&
        integrations.length > 0 &&
        findings.length === 0 &&
        siteStatus &&
        !siteStatus.gate.trustworthy && (
          <WelcomeState
            domain={
              sites.find((s) => s.id === siteId)?.domain ?? siteId
            }
            sessionsObserved={siteStatus.pipeline.sessionCount7d}
            threshold={100}
            siteId={siteId}
          />
        )}

      {siteId &&
        !(
          integrations.length > 0 &&
          findings.length === 0 &&
          siteStatus &&
          !siteStatus.gate.trustworthy
        ) && (
        <>
          {/* Stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <StatCard
              label="Integrations"
              value={`${healthyIntegrations.length}/${integrations.length}`}
              sub={integrations.length === 0 ? "None connected" : "healthy"}
            />
            <StatCard
              label="Last sync"
              value={relativeTime(lastSync)}
              sub={integrations.length > 0 ? "most recent" : "—"}
            />
            <StatCard
              label="Open findings"
              value={openFindings.length}
              sub={findings.length > 0 ? `${findings.length} total` : "Run an audit"}
            />
            {totalRiskDollars !== null ? (
              <StatCard
                label="Revenue at risk"
                value={fmtRevenue(totalRiskDollars)}
                sub="estimated / month"
                accent
              />
            ) : (
              <StatCard
                label="Experiments"
                value={activeExperiments.length}
                sub={`${experiments.length} total`}
              />
            )}
          </div>

          {/* Two-col layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 300px",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* Left: Top findings */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Top opportunities
                </h2>
                {openFindings.length > 3 && (
                  <Link
                    href={`/dashboard/findings?siteId=${siteId}`}
                    style={{ fontSize: 13, color: MUTED, textDecoration: "none" }}
                  >
                    View all {openFindings.length} →
                  </Link>
                )}
              </div>

              {topFindings.length === 0 ? (
                <Card style={{ textAlign: "center", padding: "36px 24px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>
                    No open findings yet.
                  </p>
                  <p style={{ margin: "0 0 16px", fontSize: 13, color: MUTED }}>
                    Run an audit to discover what to fix first.
                  </p>
                  <button
                    type="button"
                    onClick={() => void runSync()}
                    disabled={loadingPhase === "syncing"}
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
                    {loadingPhase === "syncing" ? "Running…" : "Run audit"}
                  </button>
                </Card>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {topFindings.map((f) => (
                    <Link
                      key={f.id}
                      href={`/dashboard/findings/${f.id}?siteId=${siteId}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <Card
                        style={{
                          cursor: "pointer",
                          transition: "border-color 0.15s",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                flexWrap: "wrap",
                                marginBottom: 4,
                              }}
                            >
                              <SeverityBadge severity={f.severity} />
                              <span
                                style={{ fontSize: 11, color: MUTED }}
                              >
                                {f.pathRef ?? "site-wide"} · {f.category}
                              </span>
                            </div>
                            <p
                              style={{
                                margin: "0 0 4px",
                                fontSize: 15,
                                fontWeight: 600,
                                letterSpacing: "-0.01em",
                                lineHeight: 1.3,
                              }}
                            >
                              {f.title}
                            </p>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 13,
                                color: MUTED,
                                lineHeight: 1.5,
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              } as React.CSSProperties}
                            >
                              {f.summary}
                            </p>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            {monthlyRevCents ? (
                              <>
                                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "#7F1D1D" }}>
                                  ~{fmtRevenue(revenueAtRisk(monthlyRevCents, f.priorityScore, f.confidence))}/mo
                                </p>
                                <p style={{ margin: 0, fontSize: 11, color: MUTED }}>at risk</p>
                              </>
                            ) : (
                              <>
                                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
                                  {(f.priorityScore * 100).toFixed(0)}
                                </p>
                                <p style={{ margin: 0, fontSize: 11, color: MUTED }}>priority</p>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}

              {/* Active experiments strip */}
              {activeExperiments.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h2
                    style={{
                      margin: "0 0 12px",
                      fontSize: 15,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Running experiments
                  </h2>
                  <div style={{ display: "grid", gap: 10 }}>
                    {activeExperiments.map((e) => {
                      // eslint-disable-next-line react-hooks/purity
                      const nowMs = Date.now();
                      const daysElapsed = e.startedAt
                        ? Math.floor(
                            (nowMs - new Date(e.startedAt).getTime()) / 86_400_000
                          )
                        : 0;
                      const confidence = e.resultConfidence ?? 0;
                      return (
                        <Link
                          key={e.id}
                          href={`/dashboard/experiments/${e.id}?siteId=${siteId}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <Card>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 12,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    margin: "0 0 3px",
                                    fontSize: 14,
                                    fontWeight: 600,
                                  }}
                                >
                                  {e.hypothesis}
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
                                  {e.primaryMetric} · Day {daysElapsed} of{" "}
                                  {e.durationDays}
                                </p>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                {/* Confidence bar */}
                                <div
                                  style={{
                                    width: 80,
                                    height: 4,
                                    borderRadius: 999,
                                    background: HAIRLINE,
                                    overflow: "hidden",
                                    marginBottom: 3,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${confidence * 100}%`,
                                      height: "100%",
                                      borderRadius: 999,
                                      background:
                                        confidence >= 0.95
                                          ? "#16A34A"
                                          : confidence >= 0.7
                                          ? "#D97706"
                                          : INK,
                                      transition: "width 0.3s",
                                    }}
                                  />
                                </div>
                                <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                                  {(confidence * 100).toFixed(0)}% conf.
                                </p>
                              </div>
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Connections + activity */}
            <div style={{ display: "grid", gap: 12 }}>
              {/* Connections */}
              <Card>
                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  Connections
                </p>
                {integrations.length === 0 ? (
                  <div>
                    <p style={{ margin: "0 0 12px", fontSize: 13, color: MUTED }}>
                      No integrations yet.
                    </p>
                    <Link
                      href={`/dashboard/connect?siteId=${siteId}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: `1px solid ${HAIRLINE}`,
                        fontSize: 13,
                        textDecoration: "none",
                        color: INK,
                        fontWeight: 500,
                      }}
                    >
                      + Add connection
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {integrations.map((i) => (
                      <div
                        key={i.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <StatusDot ok={i.status === "active" && !i.lastErrorCode} />
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              textTransform: "capitalize",
                            }}
                          >
                            {i.provider}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: MUTED }}>
                          {i.lastErrorCode
                            ? `Error: ${i.lastErrorCode}`
                            : relativeTime(i.lastSyncedAt)}
                        </span>
                      </div>
                    ))}
                    <Link
                      href={`/dashboard/connect?siteId=${siteId}`}
                      style={{
                        display: "inline-block",
                        marginTop: 6,
                        fontSize: 13,
                        color: MUTED,
                        textDecoration: "none",
                      }}
                    >
                      + Add connection
                    </Link>
                  </div>
                )}
              </Card>

              {/* Baseline learning card */}
              <Card>
                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  Baseline health
                </p>
                {siteStatus ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    {/* Readiness bar */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 5,
                        }}
                      >
                        <span style={{ fontSize: 12, color: MUTED }}>Data readiness</span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: siteStatus.gate.trustworthy ? "#16A34A" : INK,
                          }}
                        >
                          {siteStatus.gate.trustworthy ? "Ready" : `${siteStatus.readinessPercent}%`}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 5,
                          borderRadius: 999,
                          background: HAIRLINE,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${siteStatus.readinessPercent}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: siteStatus.gate.trustworthy ? "#16A34A" : INK,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats row */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          background: SUBTLE,
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                          {siteStatus.pipeline.eventCount7d.toLocaleString()}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                          events (7d)
                        </p>
                      </div>
                      <div
                        style={{
                          background: SUBTLE,
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                          {siteStatus.pipeline.sessionCount7d.toLocaleString()}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                          sessions (7d)
                        </p>
                      </div>
                    </div>

                    {/* Gate warnings */}
                    {siteStatus.gate.blockCount > 0 && (
                      <div
                        style={{
                          background: "rgba(120,53,15,0.06)",
                          border: "1px solid rgba(120,53,15,0.12)",
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 4px",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#78350F",
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                          }}
                        >
                          {siteStatus.gate.blockCount} blocking issue{siteStatus.gate.blockCount !== 1 ? "s" : ""}
                        </p>
                        {siteStatus.gate.warnings
                          .filter((w) => w.level === "block")
                          .slice(0, 2)
                          .map((w) => (
                            <p
                              key={w.code}
                              style={{ margin: "2px 0 0", fontSize: 12, color: "#78350F" }}
                            >
                              {w.message}
                            </p>
                          ))}
                      </div>
                    )}

                    {!siteStatus.gate.trustworthy && siteStatus.gate.blockCount === 0 && (
                      <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
                        Collecting data — re-run audit after more sessions arrive.
                      </p>
                    )}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Loading…</p>
                )}
              </Card>

              {/* Quick actions */}
              <Card>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  Actions
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    {
                      label: "View all findings",
                      href: `/dashboard/findings?siteId=${siteId}`,
                    },
                    {
                      label: "Experiments",
                      href: `/dashboard/experiments?siteId=${siteId}`,
                    },
                    {
                      label: "Export receipt",
                      href: `/api/phase2/insights/receipt?siteId=${siteId}&format=markdown`,
                    },
                    {
                      label: "API docs",
                      href: "/docs",
                    },
                  ].map(({ label, href }) => (
                    <Link
                      key={label}
                      href={href}
                      style={{
                        display: "block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${HAIRLINE}`,
                        fontSize: 13,
                        textDecoration: "none",
                        color: INK,
                        background: "#fff",
                        transition: "background 0.1s",
                      }}
                    >
                      {label} →
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export with Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function CockpitPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: "48px",
            color: MUTED,
            fontSize: 14,
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          Loading…
        </div>
      }
    >
      <CockpitContent />
    </Suspense>
  );
}

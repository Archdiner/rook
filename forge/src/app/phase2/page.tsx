"use client";

/**
 * Interactive Phase 2 surface — consumes `/api/phase2/insights/run` auditReport.
 * Mirrors the tonal shell of `/phase1` (inline styles) for visual continuity.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const INK = "#111111";
const MUTED = "#6B6B6B";
const CREAM = "#FAFAF8";
const HAIRLINE = "rgba(0,0,0,0.12)";

function unwrapEnvelope(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const r = payload as Record<string, unknown>;
  if ("data" in r && r.data !== undefined) return r.data;
  return payload;
}

type AuditFindingUi = {
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
};

type DiagnosticsRow = {
  ruleId: string;
  emitted?: number;
  skippedReason?: string;
};

export default function Phase2InsightsPage(): React.ReactElement {
  const defaultOrg = useMemo(() => process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "org_default", []);

  const clerkEnabled = useMemo(() => process.env.NEXT_PUBLIC_FORGE_CLERK_ENABLED === "true", []);

  const [organizationId] = useState(defaultOrg);

  const apiFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const baseHeaders: HeadersInit = {
        ...(init?.headers as Record<string, string> | undefined),
      };
      const headers = new Headers(baseHeaders);
      if (!clerkEnabled) {
        headers.set("x-org-id", organizationId);
      }
      if (
        !headers.has("Content-Type") &&
        init?.method &&
        init.method !== "GET" &&
        init.method !== "HEAD"
      ) {
        const hasBody = init.body !== undefined && init.body !== null;
        if (hasBody && typeof init.body === "string") {
          headers.set("Content-Type", "application/json");
        }
      }
      return fetch(input, {
        ...init,
        credentials: clerkEnabled ? "include" : "same-origin",
        headers,
      });
    },
    [clerkEnabled, organizationId],
  );

  type SiteMini = { id: string; name: string };

  const [sites, setSites] = useState<SiteMini[]>([]);
  const [sitesState, setSitesState] = useState<"idle" | "loading" | "error">("idle");
  const [siteId, setSiteId] = useState<string>("");
  const [days, setDays] = useState(7);

  const [insightsState, setInsightsState] = useState<"idle" | "loading" | "error">("idle");
  const [insightsErr, setInsightsErr] = useState("");
  const [trustworthy, setTrustworthy] = useState<boolean | null>(null);
  const [findingsPhase1Count, setFindingsPhase1Count] = useState(0);
  const [auditRows, setAuditRows] = useState<AuditFindingUi[]>([]);
  const [diagnosticsRows, setDiagnosticsRows] = useState<DiagnosticsRow[]>([]);
  const [grounded, setGrounded] = useState(false);

  useEffect(() => {
    async function boot() {
      setSitesState("loading");
      try {
        const res = await apiFetch("/api/phase1/sites");
        const json = (await res.json()) as { success?: boolean; data?: unknown };
        let list: unknown[] = [];
        if (json.success === true && Array.isArray(json.data)) {
          list = json.data as unknown[];
        } else if (typeof json.success === "boolean" ? !json.success : false) {
          list = [];
        } else {
          const fallback = unwrapEnvelope(json);
          if (Array.isArray(fallback)) list = fallback as unknown[];
        }
        const next: SiteMini[] = [];
        for (const item of list) {
          if (!item || typeof item !== "object") continue;
          const r = item as Record<string, unknown>;
          const idVal = r.id ?? r.siteId;
          if (typeof idVal === "string") {
            next.push({
              id: idVal,
              name: typeof r.name === "string" ? r.name : idVal,
            });
          }
        }
        setSites(next);
        setSitesState("idle");
        setSiteId((current) =>
          next.some((site) => site.id === current) ? current : next[0]?.id ?? "",
        );
      } catch {
        setSitesState("error");
      }
    }
    void boot();
  }, [organizationId, apiFetch]);

  async function runInsights(event: React.FormEvent) {
    event.preventDefault();
    if (!siteId) return;
    setInsightsState("loading");
    setInsightsErr("");
    const endMs = Date.now();
    const startMs = endMs - days * 86400000;
    try {
      const res = await apiFetch("/api/phase2/insights/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteId,
          window: {
            start: new Date(startMs).toISOString(),
            end: new Date(endMs).toISOString(),
          },
          maxFindings: 12,
        }),
      });

      const json = (await res.json()) as Record<string, unknown>;
      const unfolded = unwrapEnvelope(json);

      type InsightsEnvelope = {
        trustworthy?: unknown;
        findings?: unknown[];
        auditReport?: {
          findings?: unknown[];
          diagnostics?: unknown[];
          groundedInSnapshots?: unknown;
        };
        /** Older responses before rename (#10) — same shape */
        designReport?: {
          findings?: unknown[];
          diagnostics?: unknown[];
          groundedInSnapshots?: unknown;
        };
      };

      let okPayload: InsightsEnvelope | null = null;

      if (
        typeof json.success === "boolean" &&
        json.success === true &&
        json.data &&
        typeof json.data === "object" &&
        "trustworthy" in (json.data as object)
      ) {
        okPayload = json.data as InsightsEnvelope;
      } else if (
        unfolded !== null &&
        unfolded !== undefined &&
        typeof unfolded === "object" &&
        "trustworthy" in (unfolded as object)
      ) {
        okPayload = unfolded as InsightsEnvelope;
      }

      function pickInsightsErrorEnvelope(source: Record<string, unknown>): string {
        const err = source.error;
        if (err && typeof err === "object" && err !== null) {
          const m = (err as { message?: unknown }).message;
          if (typeof m === "string") return m;
          const nested = err as Record<string, unknown>;
          const code = nested.code;
          if (typeof code === "string") return code;
        }
        const topMsg = source.message;
        if (typeof topMsg === "string") return topMsg;
        return "Insights request failed.";
      }

      if (!res.ok || !okPayload) {
        throw new Error(pickInsightsErrorEnvelope(json));
      }

      function pickAuditBlock(env: InsightsEnvelope): {
        findings?: unknown[];
        diagnostics?: unknown[];
        groundedInSnapshots?: unknown;
      } {
        if (env.auditReport && typeof env.auditReport === "object") return env.auditReport;
        if (env.designReport && typeof env.designReport === "object") return env.designReport;
        return {};
      }

      const f1 = Array.isArray(okPayload.findings) ? okPayload.findings.length : 0;
      const ar = pickAuditBlock(okPayload);
      const rawFindings = Array.isArray(ar?.findings) ? ar!.findings! : [];

      const norm: AuditFindingUi[] = rawFindings
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => ({
          id: String(item.id ?? ""),
          ruleId: String(item.ruleId ?? ""),
          category: String(item.category ?? ""),
          severity: String(item.severity ?? ""),
          confidence: typeof item.confidence === "number" ? item.confidence : 0,
          priorityScore: typeof item.priorityScore === "number" ? item.priorityScore : 0,
          pathRef: typeof item.pathRef === "string" || item.pathRef === null ? item.pathRef : String(item.pathRef),
          title: String(item.title ?? ""),
          summary: String(item.summary ?? ""),
          recommendation: Array.isArray(item.recommendation)
            ? item.recommendation.map(String)
            : [],
        }));

      const diagsRaw = Array.isArray(ar?.diagnostics) ? ar!.diagnostics! : [];
      const diagnostics: DiagnosticsRow[] = diagsRaw
        .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
        .map((d) => ({
          ruleId: String(d.ruleId ?? ""),
          ...(typeof d.emitted === "number" ? { emitted: d.emitted } : {}),
          ...(typeof d.skippedReason === "string" ? { skippedReason: d.skippedReason } : {}),
        }));

      setFindingsPhase1Count(f1);
      setAuditRows(norm);
      setDiagnosticsRows(diagnostics);
      setTrustworthy(okPayload.trustworthy === true);
      setGrounded(ar?.groundedInSnapshots === true);
      setInsightsState("idle");
    } catch (e) {
      setInsightsErr(e instanceof Error ? e.message : String(e));
      setInsightsState("error");
    }
  }

  function badge(sev: string): React.ReactElement {
    const s = sev?.toLowerCase() ?? "";
    const bg =
      s === "critical"
        ? "rgba(154,31,42,0.12)"
        : s === "warn"
          ? "rgba(180,83,9,0.14)"
          : "rgba(15,118,110,0.12)";
    const fg = s === "critical" ? "#7F1D1D" : s === "warn" ? "#92400E" : "#065F46";
    return (
      <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>
        {sev?.toUpperCase() ?? "?"}
      </span>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: CREAM,
        padding: "32px clamp(24px,4vw,64px)",
        color: INK,
        fontFamily:
          'var(--font-inter), ui-sans-serif, system-ui, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <header style={{ marginBottom: "28px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>
            Forge — Phase 2
          </p>
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(28px, 4vw, 36px)", letterSpacing: "-0.03em" }}>
            Audit report (design + pain)
          </h1>
          <p style={{ margin: 0, color: MUTED, fontSize: 15, lineHeight: 1.6 }}>
            Runs the same deterministic rules as `/api/phase2/insights/run`. The audit payload field is
            `auditReport` (formerly `designReport` on older stacks); Phase 1 statistical findings remain in the API
            payload (count below).
          </p>
          <nav style={{ marginTop: "14px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link href="/" style={{ color: INK }}>
              ← Home
            </Link>
            <Link href="/phase1" style={{ color: INK }}>
              Phase 1 explorer
            </Link>
          </nav>
        </header>

        <form
          onSubmit={runInsights}
          style={{
            borderRadius: "14px",
            border: `1px solid ${HAIRLINE}`,
            padding: "18px",
            marginBottom: "20px",
            background: "#fff",
          }}
        >
          <label style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Site</span>
            <select
              value={siteId}
              onChange={(ev) => setSiteId(ev.target.value)}
              style={{ flex: "1 1 220px", padding: "8px", borderRadius: 10, border: `1px solid ${HAIRLINE}` }}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.id})
                </option>
              ))}
              {sites.length === 0 && <option value="">No sites · create via /phase1 form</option>}
            </select>
            <select
              value={days}
              onChange={(ev) => setDays(Number.parseInt(ev.target.value, 10))}
              style={{ padding: "8px", borderRadius: 10, border: `1px solid ${HAIRLINE}` }}
            >
              {[1, 3, 7, 14, 30].map((value) => (
                <option key={value} value={value}>{value === 30 ? `${value} days` : `${value} day${value > 1 ? "s" : ""}`}</option>
              ))}
            </select>
          </label>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: MUTED }}>
            Org identity: `{organizationId}` (set `NEXT_PUBLIC_DEFAULT_ORG_ID` or Phase 2 header mode for production.)
          </p>
          <button
            type="submit"
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "none",
              background: insightsState === "loading" ? "#555" : INK,
              color: CREAM,
              fontWeight: 600,
              cursor: insightsState === "loading" ? "not-allowed" : "pointer",
            }}
            disabled={insightsState === "loading" || sitesState === "error"}
          >
            {insightsState === "loading" ? "Running…" : "Run insights"}
          </button>
          {insightsState === "error" && (
            <p style={{ margin: "10px 0 0", color: "#9A1F2A" }} role="alert">
              {insightsErr}
            </p>
          )}
        </form>

        {trustworthy !== null && findingsPhase1Count >= 0 && (
          <p style={{ margin: "0 0 16px", fontSize: 14, color: MUTED }}>
            Phase 1 findings:{" "}
            <strong>{findingsPhase1Count}</strong>; gate trustworthy:{" "}
            <strong>{trustworthy ? "yes" : "no"}</strong>; snapshots:{" "}
            <strong>{grounded ? "grounded (≥1 snapshot row)" : "none / not required"}</strong>
          </p>
        )}

        <section>
          <h2 style={{ fontSize: 20, letterSpacing: "-0.02em", marginBottom: "8px" }}>Audit findings</h2>
          {insightsState !== "loading" && auditRows.length === 0 && (
            <p style={{ margin: "0", color: MUTED }}>Load once to populate — empty means rules returned nothing.</p>
          )}
          <div style={{ display: "grid", gap: "14px", marginTop: "12px" }}>
            {auditRows.map((f) => (
              <article
                key={f.id || f.ruleId}
                style={{
                  border: `1px solid ${HAIRLINE}`,
                  borderRadius: "14px",
                  padding: "16px",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>{f.title}</h3>
                      {badge(f.severity)}
                    </div>
                    <p style={{ margin: "6px 0 0", color: MUTED, fontSize: 12 }}>
                      {f.ruleId} · {f.category}
                      {f.pathRef !== null ? ` · ${f.pathRef}` : " · site-wide"}
                    </p>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: MUTED, textAlign: "right", minWidth: "120px" }}>
                    priority {(f.priorityScore * 100).toFixed(1)} pts · {(f.confidence * 100).toFixed(0)}% conf
                  </p>
                </div>
                <p style={{ margin: "14px 0 0", lineHeight: 1.65, fontSize: 14 }}>{f.summary}</p>
                {f.recommendation.length > 0 && (
                  <div style={{ marginTop: "12px", display: "grid", gap: "10px", fontSize: 14, lineHeight: 1.65 }}>
                    {f.recommendation.map((para, idx) => (
                      <p key={`${f.id}-para-${idx}`}>{para}</p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {diagnosticsRows.length > 0 && (
          <section style={{ marginTop: "28px" }}>
            <h2 style={{ fontSize: 20, letterSpacing: "-0.02em", marginBottom: "10px" }}>Rule diagnostics</h2>
            <div style={{ display: "grid", gap: "8px", fontSize: 13 }}>
              {diagnosticsRows.map((d) => (
                <div key={d.ruleId} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${HAIRLINE}`, paddingBottom: "6px" }}>
                  <strong>{d.ruleId}</strong>
                  <span style={{ color: MUTED }}>
                    emitted {typeof d.emitted === "number" ? d.emitted : "—"}
                    {d.skippedReason ? ` (${d.skippedReason})` : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

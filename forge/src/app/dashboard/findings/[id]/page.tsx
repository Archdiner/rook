"use client";

/**
 * FORGE-066/067/068 — Finding detail: evidence + preview slot + approve → measure
 *
 * The full loop for a single finding:
 *   1. Evidence table (why we flagged this)
 *   2. Preview slot (paste staging URL / notes)
 *   3. Approve → opens experiment creation panel
 *   4. Dismiss
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";

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
  previewType: string | null;
  previewNotes: string | null;
  lastSeenAt: string;
  insightWindowStart: string | null;
  insightWindowEnd: string | null;
};

type ExperimentDraft = {
  hypothesis: string;
  primaryMetric: string;
  primaryMetricSource: string;
  durationDays: number;
  audienceControlPct: number;
  externalUrl: string;
  startImmediately: boolean;
};

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
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
      background: bg, color: fg, textTransform: "uppercase" as const,
    }}>
      {severity}
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
    <p style={{
      margin: "0 0 12px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase" as const,
      color: MUTED,
    }}>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function FindingDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const siteId = searchParams.get("siteId") ?? "";
  const measureRef = useRef<HTMLDivElement>(null);

  const clerkEnabled = useMemo(() => process.env.NEXT_PUBLIC_FORGE_CLERK_ENABLED === "true", []);
  const defaultOrg = useMemo(() => process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "org_default", []);

  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Preview form
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState("staging");
  const [previewNotes, setPreviewNotes] = useState("");
  const [previewSaving, setPreviewSaving] = useState(false);
  const [previewSaved, setPreviewSaved] = useState(false);

  // Experiment creation panel
  const [showExperiment, setShowExperiment] = useState(false);
  const [expDraft, setExpDraft] = useState<ExperimentDraft>({
    hypothesis: "",
    primaryMetric: "",
    primaryMetricSource: "posthog",
    durationDays: 14,
    audienceControlPct: 50,
    externalUrl: "",
    startImmediately: false,
  });
  const [expCreating, setExpCreating] = useState(false);
  const [expCreated, setExpCreated] = useState<{ id: string } | null>(null);
  const [expError, setExpError] = useState("");

  // Status actions
  const [actionPending, setActionPending] = useState(false);

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
        const res = await apiFetch(`/api/dashboard/findings/${params.id}`);
        const json = await res.json() as { success?: boolean; data?: Finding };
        if (json.success && json.data) {
          setFinding(json.data);
          setPreviewUrl(json.data.previewUrl ?? "");
          setPreviewType(json.data.previewType ?? "staging");
          setPreviewNotes(json.data.previewNotes ?? "");
          // Auto-populate experiment hypothesis from finding title
          setExpDraft((d) => ({
            ...d,
            hypothesis: json.data
              ? `Fixing "${json.data.title}" will reduce friction on ${json.data.pathRef ?? "the site"}`
              : d.hypothesis,
          }));
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    void load();
    // Scroll to #measure if hash present
    if (typeof window !== "undefined" && window.location.hash === "#measure") {
      setTimeout(() => measureRef.current?.scrollIntoView({ behavior: "smooth" }), 400);
    }
  }, [params.id, apiFetch]);

  async function savePreview() {
    if (!finding) return;
    setPreviewSaving(true);
    setPreviewSaved(false);
    try {
      const res = await apiFetch(`/api/dashboard/findings/${finding.id}`, {
        method: "PATCH",
        body: JSON.stringify({ previewUrl: previewUrl.trim() || null, previewType, previewNotes: previewNotes.trim() || null }),
      });
      const json = await res.json() as { success?: boolean; data?: Finding };
      if (json.success && json.data) {
        setFinding(json.data);
        setPreviewSaved(true);
      }
    } finally {
      setPreviewSaving(false);
    }
  }

  async function updateStatus(status: string) {
    if (!finding) return;
    setActionPending(true);
    try {
      const res = await apiFetch(`/api/dashboard/findings/${finding.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const json = await res.json() as { success?: boolean; data?: Finding };
      if (json.success && json.data) setFinding(json.data);
    } finally {
      setActionPending(false);
    }
  }

  async function createExperiment() {
    if (!finding) return;
    setExpCreating(true);
    setExpError("");
    try {
      const res = await apiFetch("/api/dashboard/experiments", {
        method: "POST",
        body: JSON.stringify({
          siteId,
          findingId: finding.id,
          hypothesis: expDraft.hypothesis,
          primaryMetric: expDraft.primaryMetric,
          primaryMetricSource: expDraft.primaryMetricSource,
          durationDays: expDraft.durationDays,
          audienceControlPct: expDraft.audienceControlPct,
          externalUrl: expDraft.externalUrl || null,
          startImmediately: expDraft.startImmediately,
        }),
      });
      const json = await res.json() as { success?: boolean; data?: { id: string } };
      if (json.success && json.data) {
        setExpCreated(json.data);
        setFinding((prev) => prev ? { ...prev, status: "approved" } : prev);
      } else {
        setExpError("Failed to create experiment. Try again.");
      }
    } finally {
      setExpCreating(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "48px", color: MUTED, fontSize: 14, fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        Loading finding…
      </div>
    );
  }

  if (notFound || !finding) {
    return (
      <div style={{ padding: "48px", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        <p style={{ fontSize: 15, color: MUTED }}>Finding not found.</p>
        <Link href={`/dashboard/findings?siteId=${siteId}`} style={{ fontSize: 13, color: INK }}>
          ← Back to findings
        </Link>
      </div>
    );
  }

  const isOpen = finding.status === "open";
  const isApproved = finding.status === "approved";

  return (
    <div style={{
      padding: "32px clamp(24px, 4vw, 48px)",
      maxWidth: 760,
      color: INK,
      fontFamily: "var(--font-inter), system-ui, sans-serif",
    }}>
      {/* Back */}
      <Link
        href={`/dashboard/findings?siteId=${siteId}`}
        style={{ fontSize: 13, color: MUTED, textDecoration: "none", display: "inline-block", marginBottom: 20 }}
      >
        ← Back to findings
      </Link>

      {/* Title block */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <SeverityBadge severity={finding.severity} />
          <span style={{ fontSize: 11, color: MUTED }}>
            {finding.pathRef ?? "site-wide"} · {finding.category} · {finding.ruleId}
          </span>
          <span style={{
            fontSize: 11, color: MUTED, padding: "1px 7px", borderRadius: 999,
            background: SUBTLE, border: `1px solid ${HAIRLINE}`,
            textTransform: "capitalize" as const,
          }}>
            {finding.status}
          </span>
        </div>
        <h1 style={{
          margin: "0 0 6px",
          fontSize: "clamp(20px, 3vw, 26px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1.2,
        }}>
          {finding.title}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.6 }}>
          Priority {(finding.priorityScore * 100).toFixed(0)} · {(finding.confidence * 100).toFixed(0)}% confidence
          {finding.insightWindowStart && (
            <> · window {new Date(finding.insightWindowStart).toLocaleDateString()} – {finding.insightWindowEnd ? new Date(finding.insightWindowEnd).toLocaleDateString() : "now"}</>
          )}
        </p>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {/* Summary */}
        <Card>
          <SectionLabel>Why we flagged this</SectionLabel>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: INK }}>{finding.summary}</p>
        </Card>

        {/* Evidence */}
        {finding.evidence && finding.evidence.length > 0 && (
          <Card>
            <SectionLabel>Evidence</SectionLabel>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
              marginBottom: 12,
            }}>
              {finding.evidence.map((ev, idx) => (
                <div key={idx} style={{
                  padding: "12px 14px",
                  background: SUBTLE,
                  borderRadius: 10,
                  border: `1px solid ${HAIRLINE}`,
                }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: MUTED, letterSpacing: "0.04em" }}>
                    {ev.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {typeof ev.value === "number"
                      ? ev.value > 0 && ev.value < 1
                        ? `${(ev.value * 100).toFixed(1)}%`
                        : ev.value.toFixed(ev.value < 10 ? 1 : 0)
                      : ev.value}
                  </p>
                  {ev.context && (
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: MUTED }}>{ev.context}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recommendation */}
        {finding.recommendation && finding.recommendation.length > 0 && (
          <Card>
            <SectionLabel>What to change</SectionLabel>
            <div style={{ display: "grid", gap: 10 }}>
              {finding.recommendation.map((para, idx) => (
                <p key={idx} style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: INK }}>
                  {para}
                </p>
              ))}
            </div>
          </Card>
        )}

        {/* Preview slot */}
        <Card>
          <SectionLabel>Preview</SectionLabel>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
            Add a link to where stakeholders can see the proposed change before it reaches full traffic.
            This could be a staging URL, a branch deployment, a Figma frame, or any live preview.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Preview type
              </label>
              <select
                value={previewType}
                onChange={(e) => setPreviewType(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${HAIRLINE}`,
                  background: "#fff",
                  fontSize: 13,
                  color: INK,
                  cursor: "pointer",
                  width: "100%",
                  maxWidth: 240,
                }}
              >
                <option value="staging">Staging URL</option>
                <option value="deployment">Branch deployment</option>
                <option value="image">Screenshot / image</option>
                <option value="mock">Figma / mock</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                URL or link
              </label>
              <input
                value={previewUrl}
                onChange={(e) => { setPreviewUrl(e.target.value); setPreviewSaved(false); }}
                placeholder="https://staging.example.com/pricing"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${HAIRLINE}`,
                  background: "#fff",
                  fontSize: 14,
                  color: INK,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Notes (optional)
              </label>
              <textarea
                value={previewNotes}
                onChange={(e) => { setPreviewNotes(e.target.value); setPreviewSaved(false); }}
                placeholder="What changed in this version? What should reviewers look for?"
                rows={3}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${HAIRLINE}`,
                  background: "#fff",
                  fontSize: 13,
                  color: INK,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => void savePreview()}
                disabled={previewSaving}
                style={{
                  padding: "9px 18px",
                  borderRadius: 999,
                  border: "none",
                  background: previewSaving ? "#555" : INK,
                  color: CREAM,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: previewSaving ? "not-allowed" : "pointer",
                }}
              >
                {previewSaving ? "Saving…" : "Save preview"}
              </button>
              {previewSaved && (
                <span style={{ fontSize: 13, color: "#065F46" }}>Saved.</span>
              )}
              {finding.previewUrl && (
                <a
                  href={finding.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "9px 18px",
                    borderRadius: 999,
                    border: `1px solid ${HAIRLINE}`,
                    fontSize: 13,
                    fontWeight: 500,
                    color: INK,
                    textDecoration: "none",
                    background: "#fff",
                  }}
                >
                  Open preview →
                </a>
              )}
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isOpen && (
            <>
              <button
                type="button"
                disabled={actionPending}
                onClick={() => { updateStatus("approved").catch(() => {}); setShowExperiment(true); }}
                style={{
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: "none",
                  background: INK,
                  color: CREAM,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: actionPending ? "not-allowed" : "pointer",
                }}
              >
                Approve & start measuring →
              </button>
              <button
                type="button"
                disabled={actionPending}
                onClick={() => void updateStatus("dismissed")}
                style={{
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: `1px solid ${HAIRLINE}`,
                  background: "transparent",
                  fontSize: 14,
                  color: MUTED,
                  cursor: actionPending ? "not-allowed" : "pointer",
                }}
              >
                Dismiss
              </button>
            </>
          )}
          {isApproved && !expCreated && (
            <button
              type="button"
              onClick={() => setShowExperiment(true)}
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                border: "none",
                background: INK,
                color: CREAM,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Create experiment →
            </button>
          )}
          {expCreated && (
            <Link
              href={`/dashboard/experiments/${expCreated.id}?siteId=${siteId}`}
              style={{
                display: "inline-block",
                padding: "10px 22px",
                borderRadius: 999,
                border: "none",
                background: INK,
                color: CREAM,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              View experiment →
            </Link>
          )}
          <a
            href={`/api/phase2/insights/receipt?siteId=${siteId}&format=markdown`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 22px",
              borderRadius: 999,
              border: `1px solid ${HAIRLINE}`,
              fontSize: 14,
              color: MUTED,
              textDecoration: "none",
              background: "#fff",
            }}
          >
            Export receipt
          </a>
        </div>

        {/* Experiment creation panel */}
        {showExperiment && !expCreated && (
          <div ref={measureRef} id="measure">
            <Card>
              <SectionLabel>Start measuring</SectionLabel>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
                Define how you'll measure impact in production. This creates an experiment record in
                Forge—link it to your analytics provider so lift claims stay auditable.
              </p>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Hypothesis
                  </label>
                  <textarea
                    value={expDraft.hypothesis}
                    onChange={(e) => setExpDraft((d) => ({ ...d, hypothesis: e.target.value }))}
                    rows={2}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${HAIRLINE}`,
                      background: "#fff",
                      fontSize: 13,
                      color: INK,
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                      Primary metric (event name)
                    </label>
                    <input
                      value={expDraft.primaryMetric}
                      onChange={(e) => setExpDraft((d) => ({ ...d, primaryMetric: e.target.value }))}
                      placeholder="checkout_started"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${HAIRLINE}`,
                        background: "#fff",
                        fontSize: 13,
                        color: INK,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                      Source
                    </label>
                    <select
                      value={expDraft.primaryMetricSource}
                      onChange={(e) => setExpDraft((d) => ({ ...d, primaryMetricSource: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${HAIRLINE}`,
                        background: "#fff",
                        fontSize: 13,
                        color: INK,
                        cursor: "pointer",
                      }}
                    >
                      <option value="posthog">PostHog</option>
                      <option value="segment">Segment</option>
                      <option value="custom">Custom / external</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                      Duration (days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={expDraft.durationDays}
                      onChange={(e) => setExpDraft((d) => ({ ...d, durationDays: Number(e.target.value) }))}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${HAIRLINE}`,
                        background: "#fff",
                        fontSize: 13,
                        color: INK,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                      Control split (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={expDraft.audienceControlPct}
                      onChange={(e) => setExpDraft((d) => ({ ...d, audienceControlPct: Number(e.target.value) }))}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${HAIRLINE}`,
                        background: "#fff",
                        fontSize: 13,
                        color: INK,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                    External experiment URL (PostHog / LaunchDarkly / etc — optional)
                  </label>
                  <input
                    value={expDraft.externalUrl}
                    onChange={(e) => setExpDraft((d) => ({ ...d, externalUrl: e.target.value }))}
                    placeholder="https://app.posthog.com/experiments/123"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${HAIRLINE}`,
                      background: "#fff",
                      fontSize: 13,
                      color: INK,
                    }}
                  />
                </div>
                <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={expDraft.startImmediately}
                    onChange={(e) => setExpDraft((d) => ({ ...d, startImmediately: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  Start experiment immediately (status → running)
                </label>
                {expError && (
                  <p style={{ margin: 0, fontSize: 13, color: "#7F1D1D" }}>{expError}</p>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    disabled={expCreating || !expDraft.primaryMetric || !expDraft.hypothesis}
                    onClick={() => void createExperiment()}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 999,
                      border: "none",
                      background: expCreating || !expDraft.primaryMetric || !expDraft.hypothesis ? "#999" : INK,
                      color: CREAM,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: expCreating || !expDraft.primaryMetric || !expDraft.hypothesis ? "not-allowed" : "pointer",
                    }}
                  >
                    {expCreating ? "Creating…" : "Create experiment →"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExperiment(false)}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 999,
                      border: `1px solid ${HAIRLINE}`,
                      background: "transparent",
                      fontSize: 14,
                      color: MUTED,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FindingDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: MUTED, fontSize: 14, fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Loading…</div>}>
      <FindingDetailContent />
    </Suspense>
  );
}

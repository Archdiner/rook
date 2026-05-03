"use client";

/**
 * FORGE-063 — Multi-source connection UX
 *
 * Guided flow: canonical URL → optionally GitHub → PostHog or Segment.
 * Replaces the dev-only /onboarding wizard with a real product surface.
 */

import Link from "next/link";
import { useCallback, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const CREAM = "#FAFAF8";
const INK = "#111111";
const MUTED = "#6B6B6B";
const HAIRLINE = "rgba(0,0,0,0.08)";
const SUBTLE = "rgba(0,0,0,0.04)";
const ERR_COLOR = "#7F1D1D";

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${HAIRLINE}`,
      borderRadius: 14,
      padding: "22px 24px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SourceBadge({ connected }: { connected: boolean }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "2px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: connected ? "rgba(5,150,105,0.10)" : SUBTLE,
      color: connected ? "#065F46" : MUTED,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: connected ? "#16A34A" : MUTED,
        flexShrink: 0,
      }} />
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function canonicalHost(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
  try {
    let host = new URL(href).hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch { return null; }
}

function slugify(host: string): string {
  return host.replace(/\./g, "-").replace(/[^a-z0-9-]/gi, "").replace(/-+/g, "-").replace(/^-|-$/g, "") || "site";
}

function ConnectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const existingSiteId = searchParams.get("siteId") ?? "";

  const clerkEnabled = useMemo(() => process.env.NEXT_PUBLIC_FORGE_CLERK_ENABLED === "true", []);
  const defaultOrg = useMemo(() => process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "org_default", []);

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

  // --- Step 1: Site URL ---
  const [urlInput, setUrlInput] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteId, setSiteId] = useState(existingSiteId);
  const [siteErr, setSiteErr] = useState("");
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteConnected, setSiteConnected] = useState(!!existingSiteId);

  async function registerSite() {
    const host = canonicalHost(urlInput);
    if (!host) { setSiteErr("Enter a valid URL or domain."); return; }
    setSiteBusy(true);
    setSiteErr("");
    try {
      const res = await apiFetch("/api/phase1/sites", {
        method: "POST",
        body: JSON.stringify({
          name: siteName.trim() || slugify(host),
          domain: host,
          analyticsProvider: "posthog",
        }),
      });
      const json = await res.json() as { success?: boolean; data?: { id?: string }; error?: { message?: string } };
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? "Failed to register site.");
      const id = json.data?.id;
      if (!id) throw new Error("No site id returned.");
      setSiteId(id);
      setSiteConnected(true);
      if (!siteName) setSiteName(slugify(host));
    } catch (e) {
      setSiteErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setSiteBusy(false);
    }
  }

  // --- Revenue context ---
  const [mrrInput, setMrrInput] = useState("");
  const [aovInput, setAovInput] = useState("");
  const [revenueSaved, setRevenueSaved] = useState(false);

  async function saveRevenue() {
    if (!siteId || !mrrInput) return;
    const monthlyRevenueCents = Math.round(parseFloat(mrrInput) * 100);
    const avgOrderValueCents = aovInput ? Math.round(parseFloat(aovInput) * 100) : undefined;
    try {
      await apiFetch(`/api/dashboard/site-meta?siteId=${siteId}`, {
        method: "PATCH",
        body: JSON.stringify({ monthlyRevenueCents, ...(avgOrderValueCents ? { avgOrderValueCents } : {}) }),
      });
      setRevenueSaved(true);
    } catch { /* non-fatal */ }
  }

  // --- Step 2: PostHog ---
  const [phHost, setPhHost] = useState("https://us.i.posthog.com");
  const [phProjectId, setPhProjectId] = useState("");
  const [phSecretRef, setPhSecretRef] = useState("POSTHOG_PERSONAL_API_KEY");
  const [phBusy, setPhBusy] = useState(false);
  const [phErr, setPhErr] = useState("");
  const [phIntegrationId, setPhIntegrationId] = useState("");
  const [phConnected, setPhConnected] = useState(false);
  const [phValidated, setPhValidated] = useState<string>("");

  async function connectPostHog() {
    if (!siteId) return;
    setPhBusy(true);
    setPhErr("");
    try {
      const res = await apiFetch("/api/phase2/integrations", {
        method: "POST",
        body: JSON.stringify({
          siteId,
          provider: "posthog",
          config: { host: phHost.trim(), projectId: phProjectId.trim() },
          secretRef: phSecretRef.trim(),
        }),
      });
      const json = await res.json() as { success?: boolean; data?: { id?: string }; error?: { message?: string } };
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? "Failed to create integration.");
      const id = json.data?.id;
      if (!id) throw new Error("No integration id returned.");
      setPhIntegrationId(id);
      setPhConnected(true);
    } catch (e) {
      setPhErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setPhBusy(false);
    }
  }

  async function validatePostHog() {
    if (!phIntegrationId) return;
    setPhBusy(true);
    try {
      const res = await apiFetch(`/api/phase2/integrations/${phIntegrationId}/validate`, { method: "POST" });
      const json = await res.json() as { success?: boolean; data?: { ok?: boolean; warnings?: Array<{ message?: string }> } };
      const ok = json.data?.ok;
      const warnings = json.data?.warnings?.map((w) => w.message).filter(Boolean).join("; ") ?? "";
      setPhValidated(ok ? `Connection verified.${warnings ? ` ${warnings}` : ""}` : `Issues: ${warnings || "check API key"}`);
    } catch {
      setPhValidated("Validation failed — check config.");
    } finally {
      setPhBusy(false);
    }
  }

  // --- Step 3: Segment (optional) ---
  const [segSecretRef, setSegSecretRef] = useState("SEGMENT_WEBHOOK_SECRET");
  const [segBusy, setSegBusy] = useState(false);
  const [segErr, setSegErr] = useState("");
  const [segConnected, setSegConnected] = useState(false);
  const [segWebhookUrl, setSegWebhookUrl] = useState("");

  async function connectSegment() {
    if (!siteId) return;
    setSegBusy(true);
    setSegErr("");
    try {
      const res = await apiFetch("/api/phase2/integrations", {
        method: "POST",
        body: JSON.stringify({
          siteId,
          provider: "segment",
          config: {},
          secretRef: segSecretRef.trim(),
        }),
      });
      const json = await res.json() as { success?: boolean; data?: { id?: string }; error?: { message?: string } };
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? "Failed to create Segment integration.");
      const id = json.data?.id;
      if (!id) throw new Error("No integration id.");
      setSegConnected(true);
      // Show the webhook URL the user should configure in Segment
      const base = typeof window !== "undefined" ? window.location.origin : "";
      setSegWebhookUrl(`${base}/api/phase2/integrations/${id}/segment-webhook`);
    } catch (e) {
      setSegErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setSegBusy(false);
    }
  }

  function goToDashboard() {
    router.push(`/dashboard?siteId=${siteId}`);
  }

  return (
    <div style={{
      padding: "32px clamp(24px, 4vw, 48px)",
      maxWidth: 640,
      color: INK,
      fontFamily: "var(--font-inter), system-ui, sans-serif",
    }}>
      {/* Visual header — mirrors the marketing site's particle motif as a static dot grid */}
      <div style={{
        position: "relative",
        marginBottom: 36,
        paddingBottom: 32,
        borderBottom: `1px solid ${HAIRLINE}`,
      }}>
        {/* Decorative dot grid — echoes the particle canvas DNA */}
        <div aria-hidden style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 120,
          height: 80,
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)",
          backgroundSize: "12px 12px",
          maskImage: "radial-gradient(ellipse at top right, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at top right, black 30%, transparent 80%)",
          pointerEvents: "none",
        }} />
        <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
          Zybit — Setup
        </p>
        <h1 style={{ margin: "0 0 10px", fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Connect your site.
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.65, maxWidth: 460 }}>
          Start with your URL. Zybit will begin learning your funnel immediately —
          add PostHog to unlock ranked behavioral findings.
        </p>

        {/* Progress pips */}
        <div style={{ display: "flex", gap: 6, marginTop: 18, alignItems: "center" }}>
          {[siteConnected, phConnected || segConnected, false].map((done, i) => (
            <div key={i} style={{
              width: done ? 20 : 6,
              height: 6,
              borderRadius: 999,
              background: done ? INK : HAIRLINE,
              transition: "all 0.3s ease",
            }} />
          ))}
          <span style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>
            {siteConnected && (phConnected || segConnected) ? "Ready to go →" : siteConnected ? "Add a data source" : "Step 1 of 3"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>

        {/* Step 1: Site URL */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>1. Your site URL</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>Required — the canonical domain Zybit will analyze.</p>
            </div>
            <SourceBadge connected={siteConnected} />
          </div>
          {!siteConnected ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Website URL</label>
                <input
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setSiteErr(""); }}
                  placeholder="https://www.yoursite.com"
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
                  Site name <span style={{ fontWeight: 400, color: MUTED }}>(optional — auto-generated from URL)</span>
                </label>
                <input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="my-site"
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
              {siteErr && <p style={{ margin: 0, fontSize: 13, color: ERR_COLOR }}>{siteErr}</p>}
              <button
                type="button"
                disabled={siteBusy || !urlInput.trim()}
                onClick={() => void registerSite()}
                style={{
                  padding: "10px 22px", borderRadius: 999, border: "none",
                  background: siteBusy || !urlInput.trim() ? "#999" : INK,
                  color: CREAM, fontSize: 14, fontWeight: 600,
                  cursor: siteBusy || !urlInput.trim() ? "not-allowed" : "pointer",
                  width: "fit-content",
                }}
              >
                {siteBusy ? "Connecting…" : "Connect site →"}
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
              Site registered · <code style={{ fontSize: 12, color: INK, background: SUBTLE, padding: "2px 6px", borderRadius: 5 }}>{siteId}</code>
            </p>
          )}
        </Card>

        {/* Revenue context — unlocks impact framing on findings */}
        <Card style={{ opacity: siteConnected ? 1 : 0.5 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                Revenue context <span style={{ fontWeight: 400, color: MUTED }}>— optional but recommended</span>
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>
                Zybit uses this to estimate how much each friction point is costing you per month.
              </p>
            </div>
            {revenueSaved && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "#065F46", padding: "3px 10px", borderRadius: 999, background: "rgba(5,150,105,0.08)" }}>
                Saved
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>
                Monthly revenue (USD)
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: MUTED }}>$</span>
                <input
                  value={mrrInput}
                  onChange={(e) => { setMrrInput(e.target.value); setRevenueSaved(false); }}
                  placeholder="50,000"
                  disabled={!siteConnected}
                  type="number"
                  min="0"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "9px 12px 9px 22px",
                    borderRadius: 10, border: `1px solid ${HAIRLINE}`,
                    background: siteConnected ? "#fff" : SUBTLE,
                    fontSize: 13, color: INK,
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>
                Avg. order value <span style={{ fontWeight: 400, color: MUTED }}>(optional)</span>
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: MUTED }}>$</span>
                <input
                  value={aovInput}
                  onChange={(e) => { setAovInput(e.target.value); setRevenueSaved(false); }}
                  placeholder="120"
                  disabled={!siteConnected}
                  type="number"
                  min="0"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "9px 12px 9px 22px",
                    borderRadius: 10, border: `1px solid ${HAIRLINE}`,
                    background: siteConnected ? "#fff" : SUBTLE,
                    fontSize: 13, color: INK,
                  }}
                />
              </div>
            </div>
          </div>
          {mrrInput && siteConnected && !revenueSaved && (
            <button
              type="button"
              onClick={() => void saveRevenue()}
              style={{
                marginTop: 10, padding: "8px 16px", borderRadius: 999,
                border: `1px solid ${HAIRLINE}`, background: "#fff",
                fontSize: 13, fontWeight: 500, color: INK, cursor: "pointer",
              }}
            >
              Save revenue context
            </button>
          )}
        </Card>

        {/* Step 2: PostHog */}
        <Card style={{ opacity: siteConnected ? 1 : 0.5 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>2. PostHog <span style={{ fontWeight: 400, color: MUTED }}>— behavioral data</span></p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>
                Connects Zybit to your PostHog project for event sync and insights.
              </p>
            </div>
            <SourceBadge connected={phConnected} />
          </div>
          {!phConnected ? (
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { label: "PostHog host", value: phHost, set: setPhHost, placeholder: "https://us.i.posthog.com" },
                { label: "Project ID", value: phProjectId, set: setPhProjectId, placeholder: "12345" },
                { label: "API key env var name", value: phSecretRef, set: setPhSecretRef, placeholder: "POSTHOG_PERSONAL_API_KEY" },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</label>
                  <input
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    disabled={!siteConnected}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: `1px solid ${HAIRLINE}`,
                      background: siteConnected ? "#fff" : SUBTLE,
                      fontSize: 13,
                      color: INK,
                    }}
                  />
                </div>
              ))}
              {phErr && <p style={{ margin: 0, fontSize: 13, color: ERR_COLOR }}>{phErr}</p>}
              <button
                type="button"
                disabled={phBusy || !siteConnected || !phProjectId.trim()}
                onClick={() => void connectPostHog()}
                style={{
                  padding: "9px 18px", borderRadius: 999, border: "none",
                  background: phBusy || !siteConnected || !phProjectId.trim() ? "#999" : INK,
                  color: CREAM, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", width: "fit-content",
                }}
              >
                {phBusy ? "Connecting…" : "Connect PostHog"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {!phValidated ? (
                <button
                  type="button"
                  onClick={() => void validatePostHog()}
                  disabled={phBusy}
                  style={{
                    padding: "8px 16px", borderRadius: 999,
                    border: `1px solid ${HAIRLINE}`, background: "#fff",
                    fontSize: 13, fontWeight: 500, color: INK, cursor: "pointer",
                  }}
                >
                  Validate connection
                </button>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: phValidated.startsWith("Connection verified") ? "#065F46" : ERR_COLOR }}>
                  {phValidated}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Step 3: Segment (optional) */}
        <Card style={{ opacity: siteConnected ? 1 : 0.5 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                3. Segment <span style={{ fontWeight: 400, color: MUTED }}>— optional</span>
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>
                Route Segment events to Zybit via webhook for additional signal.
              </p>
            </div>
            <SourceBadge connected={segConnected} />
          </div>
          {!segConnected ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 5 }}>
                  Webhook secret env var name
                </label>
                <input
                  value={segSecretRef}
                  onChange={(e) => setSegSecretRef(e.target.value)}
                  placeholder="SEGMENT_WEBHOOK_SECRET"
                  disabled={!siteConnected}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: `1px solid ${HAIRLINE}`,
                    background: siteConnected ? "#fff" : SUBTLE,
                    fontSize: 13,
                    color: INK,
                  }}
                />
              </div>
              {segErr && <p style={{ margin: 0, fontSize: 13, color: ERR_COLOR }}>{segErr}</p>}
              <button
                type="button"
                disabled={segBusy || !siteConnected}
                onClick={() => void connectSegment()}
                style={{
                  padding: "9px 18px", borderRadius: 999, border: `1px solid ${HAIRLINE}`,
                  background: "transparent", fontSize: 13, fontWeight: 500,
                  color: INK, cursor: siteConnected ? "pointer" : "not-allowed",
                  width: "fit-content",
                }}
              >
                {segBusy ? "Connecting…" : "Connect Segment"}
              </button>
            </div>
          ) : (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: MUTED }}>
                Segment integration created. Configure this webhook URL in your Segment destination:
              </p>
              <code style={{ display: "block", fontSize: 12, padding: "10px 12px", borderRadius: 10, background: SUBTLE, wordBreak: "break-all" as const }}>
                {segWebhookUrl}
              </code>
            </div>
          )}
        </Card>

        {/* GitHub (labeled as coming soon) */}
        <Card style={{ opacity: 0.5 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                4. GitHub <span style={{ fontWeight: 400, color: MUTED }}>— coming soon</span>
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>
                Connect your repo to get code-level suggestions and PR drafts for approved findings.
              </p>
            </div>
            <SourceBadge connected={false} />
          </div>
        </Card>

        {/* CTA */}
        {siteConnected && (
          <button
            type="button"
            onClick={goToDashboard}
            style={{
              padding: "12px 28px", borderRadius: 999, border: "none",
              background: INK, color: CREAM, fontSize: 15, fontWeight: 700,
              cursor: "pointer", letterSpacing: "-0.01em",
            }}
          >
            Go to dashboard →
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: MUTED, fontSize: 14, fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Loading…</div>}>
      <ConnectContent />
    </Suspense>
  );
}

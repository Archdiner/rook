"use client";

/**
 * FORGE-010 — Guided onboarding wizard (site → PostHog → estimate).
 * Fetch/auth: mirrors `/phase2` when Clerk is off (`x-org-id`); when
 * `NEXT_PUBLIC_FORGE_CLERK_ENABLED` is true-ish, same-origin cookies only.
 */

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

const INK = "#111111";
const MUTED = "#6B6B6B";
const CREAM = "#FAFAF8";
const HAIRLINE = "rgba(255,255,255,0.14)";
const ERR = "#FF6B6B";

function unwrapEnvelope(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const r = payload as Record<string, unknown>;
  if ("data" in r && r.data !== undefined) return r.data;
  return payload;
}

function pickApiError(source: Record<string, unknown>): string {
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
  return "Request failed.";
}

/** Parse user input into canonical hostname (lowercase, no leading www.). */
function canonicalHostFromInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  let host = url.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  return host.length > 0 ? host : null;
}

function slugFromDomain(host: string): string {
  return host.replace(/\./g, "-").replace(/[^a-z0-9-]/gi, "").replace(/-+/g, "-").replace(/^-|-$/g, "") || "site";
}

const STEPS = ["Site URL", "Site ID", "Connect PostHog", "Estimate"] as const;

export default function OnboardingPage(): React.ReactElement {
  const defaultOrg = useMemo(() => process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "org_default", []);

  const clerkEnabled = useMemo(() => process.env.NEXT_PUBLIC_FORGE_CLERK_ENABLED === "true", []);

  const [organizationId] = useState(defaultOrg);

  const [stepIndex, setStepIndex] = useState(0);

  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [canonicalHost, setCanonicalHost] = useState<string | null>(null);
  const [step0Err, setStep0Err] = useState("");

  const [siteNameSlug, setSiteNameSlug] = useState("");
  const [registeredSiteId, setRegisteredSiteId] = useState<string | null>(null);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerErr, setRegisterErr] = useState("");

  const [phHost, setPhHost] = useState("https://us.i.posthog.com");
  const [phProjectId, setPhProjectId] = useState("");
  const [phSecretRef, setPhSecretRef] = useState("POSTHOG_PERSONAL_API_KEY");
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationErr, setIntegrationErr] = useState("");

  const [validateBusy, setValidateBusy] = useState(false);
  const [validateResult, setValidateResult] = useState<string>("");

  const [estimateBusy, setEstimateBusy] = useState(false);
  const [estimateErr, setEstimateErr] = useState("");
  const [trustworthy, setTrustworthy] = useState<boolean | null>(null);
  const [gateMessages, setGateMessages] = useState<string[]>([]);

  const apiFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const baseHeaders: HeadersInit = {
        ...(init?.headers as Record<string, string> | undefined),
      };
      const headers = new Headers(baseHeaders);
      if (!clerkEnabled) {
        headers.set("x-org-id", organizationId);
      }
      if (!headers.has("Content-Type") && init?.method && init.method !== "GET" && init.method !== "HEAD") {
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

  const goNext = (): void => {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goBack = (): void => {
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  function onCopy(text: string): void {
    void navigator.clipboard.writeText(text);
  }

  async function registerSite(): Promise<void> {
    if (!canonicalHost) return;
    setRegisterBusy(true);
    setRegisterErr("");
    try {
      const res = await apiFetch("/api/phase1/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: siteNameSlug.trim() || slugFromDomain(canonicalHost),
          domain: canonicalHost.toLowerCase(),
          analyticsProvider: "posthog",
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok || json.success !== true) {
        throw new Error(pickApiError(json));
      }
      const data = unwrapEnvelope(json) as Record<string, unknown> | null;
      const id =
        data && typeof data === "object"
          ? typeof data.id === "string"
            ? data.id
            : null
          : null;
      if (!id) throw new Error("Site created but response had no id.");
      setRegisteredSiteId(id);
    } catch (e) {
      setRegisterErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRegisterBusy(false);
    }
  }

  async function createIntegration(): Promise<void> {
    const siteId = registeredSiteId;
    if (!siteId) return;
    setIntegrationBusy(true);
    setIntegrationErr("");
    try {
      const res = await apiFetch("/api/phase2/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          provider: "posthog",
          config: {
            host: phHost.trim(),
            projectId: phProjectId.trim(),
          },
          secretRef: phSecretRef.trim(),
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok || json.success !== true) {
        throw new Error(pickApiError(json));
      }
      const data = unwrapEnvelope(json) as Record<string, unknown> | null;
      const id =
        data && typeof data === "object" && typeof data.id === "string" ? data.id : null;
      if (!id) throw new Error("Integration created but response had no id.");
      setIntegrationId(id);
    } catch (e) {
      setIntegrationErr(e instanceof Error ? e.message : String(e));
    } finally {
      setIntegrationBusy(false);
    }
  }

  async function validateIntegration(): Promise<void> {
    if (!integrationId) return;
    setValidateBusy(true);
    setValidateResult("");
    try {
      const res = await apiFetch(`/api/phase2/integrations/${integrationId}/validate`, {
        method: "POST",
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok || json.success !== true) {
        throw new Error(pickApiError(json));
      }
      const data = unwrapEnvelope(json) as Record<string, unknown> | null;
      if (data && typeof data === "object") {
        const ok = data.ok === true;
        const warnings = Array.isArray(data.warnings) ? data.warnings : [];
        const warnText = warnings
          .map((w) => {
            if (w && typeof w === "object" && w !== null) {
              const m = (w as { message?: unknown }).message;
              return typeof m === "string" ? m : JSON.stringify(w);
            }
            return String(w);
          })
          .join("; ");
        setValidateResult(ok ? `Connection OK.${warnText ? ` ${warnText}` : ""}` : `Issues: ${warnText || "check API key env var"}`);
      } else {
        setValidateResult("Validated (unexpected response shape).");
      }
    } catch (e) {
      setValidateResult(e instanceof Error ? e.message : String(e));
    } finally {
      setValidateBusy(false);
    }
  }

  async function runEstimate(): Promise<void> {
    const siteId = registeredSiteId;
    if (!siteId) return;
    setEstimateBusy(true);
    setEstimateErr("");
    setTrustworthy(null);
    setGateMessages([]);
    const endMs = Date.now();
    const startMs = endMs - 7 * 86400000;
    try {
      const res = await apiFetch("/api/phase2/insights/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      if (!res.ok || json.success !== true) {
        throw new Error(pickApiError(json));
      }
      const unfolded = unwrapEnvelope(json) as Record<string, unknown> | null;
      if (!unfolded || typeof unfolded !== "object" || !("trustworthy" in unfolded)) {
        throw new Error("Insights response missing trustworthy.");
      }
      const tw = unfolded.trustworthy === true;
      setTrustworthy(tw);
      const warnings = Array.isArray(unfolded.warnings) ? unfolded.warnings : [];
      const lines = warnings
        .map((w) => {
          if (w && typeof w === "object" && w !== null) {
            const level = (w as { level?: unknown }).level;
            const message = (w as { message?: unknown }).message;
            const code = (w as { code?: unknown }).code;
            const lv = typeof level === "string" ? level.toUpperCase() : "";
            const msg = typeof message === "string" ? message : "";
            const cd = typeof code === "string" ? `${code}: ` : "";
            return `${lv ? `[${lv}] ` : ""}${cd}${msg}`.trim();
          }
          return String(w);
        })
        .filter(Boolean);
      setGateMessages(lines);
    } catch (e) {
      setEstimateErr(e instanceof Error ? e.message : String(e));
    } finally {
      setEstimateBusy(false);
    }
  }

  const siteIdReady = Boolean(registeredSiteId);
  const canProceedStep1 = siteIdReady;
  const canProceedStep2 = Boolean(integrationId);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-inverted-bg, #0A0A0A)",
        padding: "32px clamp(24px,4vw,64px)",
        color: CREAM,
        fontFamily:
          'var(--font-inter), ui-sans-serif, system-ui, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <header style={{ marginBottom: "28px" }}>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            Forge — Guided setup
          </p>
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(24px, 4vw, 30px)", letterSpacing: "-0.03em" }}>
            Onboarding
          </h1>
          <p style={{ margin: 0, color: MUTED, fontSize: 14, lineHeight: 1.6 }}>
            Register a site, wire PostHog, then run a 7-day estimate. Org:{" "}
            <code style={{ color: CREAM, fontSize: 13 }}>{organizationId}</code>
            {!clerkEnabled ? " (via x-org-id)" : " (session)"}.
          </p>
          <nav style={{ marginTop: "14px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link href="/" style={{ color: CREAM, opacity: 0.9 }}>
              ← Home
            </Link>
            <Link href="/docs" style={{ color: CREAM, opacity: 0.9 }}>
              Docs
            </Link>
            <Link href="/phase2" style={{ color: CREAM, opacity: 0.9 }}>
              Phase 2
            </Link>
          </nav>
        </header>

        {/* Step indicator */}
        <ol
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            listStyle: "none",
            padding: 0,
            margin: "0 0 24px",
            fontSize: 12,
            color: MUTED,
          }}
        >
          {STEPS.map((label, i) => (
            <li
              key={label}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${HAIRLINE}`,
                background: i === stepIndex ? "rgba(250,250,248,0.1)" : "transparent",
                color: i === stepIndex ? CREAM : MUTED,
              }}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <section
          style={{
            borderRadius: 14,
            border: `1px solid ${HAIRLINE}`,
            padding: "22px",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          {stepIndex === 0 && (
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 600 }}>Site URL</h2>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
                Paste your marketing or app URL. We strip the protocol and normalize{" "}
                <code style={{ color: CREAM }}>www</code>.
              </p>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                URL
              </label>
              <input
                value={siteUrlInput}
                onChange={(e) => {
                  setSiteUrlInput(e.target.value);
                  setStep0Err("");
                }}
                placeholder="https://www.example.com"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${HAIRLINE}`,
                  background: "rgba(0,0,0,0.35)",
                  color: CREAM,
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const host = canonicalHostFromInput(siteUrlInput);
                  if (!host) {
                    setCanonicalHost(null);
                    setStep0Err("Enter a valid URL or hostname.");
                    return;
                  }
                  setCanonicalHost(host);
                  setSiteNameSlug((current) => (current.trim() === "" ? slugFromDomain(host) : current));
                  setStep0Err("");
                  goNext();
                }}
                style={{
                  marginTop: 14,
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "none",
                  background: CREAM,
                  color: INK,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continue
              </button>
              {step0Err && (
                <p style={{ marginTop: 10, color: ERR, fontSize: 13 }} role="alert">
                  {step0Err}
                </p>
              )}
              {canonicalHost && stepIndex === 0 && (
                <p style={{ marginTop: 14, fontSize: 13, color: MUTED }}>
                  Canonical domain:{" "}
                  <strong style={{ color: CREAM }}>{canonicalHost}</strong>
                </p>
              )}
            </div>
          )}

          {stepIndex === 1 && (
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 600 }}>Site ID</h2>
              {canonicalHost && (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: MUTED }}>
                  Domain: <strong style={{ color: CREAM }}>{canonicalHost}</strong>
                </p>
              )}
              <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
                Choose a short label (stored as site name). We register the site and show the Forge{" "}
                <code style={{ color: CREAM }}>siteId</code> (UUID) for API calls.
              </p>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Site name (slug)
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <input
                  value={siteNameSlug}
                  onChange={(e) => setSiteNameSlug(e.target.value)}
                  style={{
                    flex: "1 1 200px",
                    minWidth: 0,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${HAIRLINE}`,
                    background: "rgba(0,0,0,0.35)",
                    color: CREAM,
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={() => canonicalHost && setSiteNameSlug(slugFromDomain(canonicalHost))}
                  disabled={!canonicalHost}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${HAIRLINE}`,
                    background: "transparent",
                    color: CREAM,
                    cursor: canonicalHost ? "pointer" : "not-allowed",
                    opacity: canonicalHost ? 1 : 0.5,
                  }}
                >
                  From domain
                </button>
              </div>
              <button
                type="button"
                onClick={() => void registerSite()}
                disabled={registerBusy || !canonicalHost}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "none",
                  background: registerBusy ? "#555" : CREAM,
                  color: INK,
                  fontWeight: 600,
                  cursor: registerBusy || !canonicalHost ? "not-allowed" : "pointer",
                }}
              >
                {registerBusy ? "Registering…" : "POST /api/phase1/sites"}
              </button>
              {registerErr && (
                <p style={{ marginTop: 10, color: ERR, fontSize: 13 }} role="alert">
                  {registerErr}
                </p>
              )}
              {registeredSiteId && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, color: MUTED }}>siteId</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <code
                      style={{
                        flex: "1 1 240px",
                        fontSize: 13,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.4)",
                        wordBreak: "break-all",
                      }}
                    >
                      {registeredSiteId}
                    </code>
                    <button
                      type="button"
                      onClick={() => onCopy(registeredSiteId!)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: `1px solid ${HAIRLINE}`,
                        background: "transparent",
                        color: CREAM,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={goBack}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${HAIRLINE}`,
                    background: "transparent",
                    color: CREAM,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canProceedStep1}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "none",
                    background: canProceedStep1 ? CREAM : "#333",
                    color: canProceedStep1 ? INK : MUTED,
                    cursor: canProceedStep1 ? "pointer" : "not-allowed",
                    fontWeight: 600,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {stepIndex === 2 && (
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 600 }}>Connect PostHog</h2>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
                Create a{" "}
                <a
                  href="https://posthog.com/docs/api/overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: CREAM }}
                >
                  PostHog personal API key
                </a>{" "}
                and store it in your server env. See Forge{" "}
                <Link href="/docs" style={{ color: CREAM }}>
                  /docs
                </Link>{" "}
                for API envelopes.
              </p>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Host (full URL)</label>
                  <input
                    value={phHost}
                    onChange={(e) => setPhHost(e.target.value)}
                    style={{
                      marginTop: 6,
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${HAIRLINE}`,
                      background: "rgba(0,0,0,0.35)",
                      color: CREAM,
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Project ID</label>
                  <input
                    value={phProjectId}
                    onChange={(e) => setPhProjectId(e.target.value)}
                    style={{
                      marginTop: 6,
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${HAIRLINE}`,
                      background: "rgba(0,0,0,0.35)",
                      color: CREAM,
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>
                    secretRef (env var name for API key)
                  </label>
                  <input
                    value={phSecretRef}
                    onChange={(e) => setPhSecretRef(e.target.value)}
                    style={{
                      marginTop: 6,
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${HAIRLINE}`,
                      background: "rgba(0,0,0,0.35)",
                      color: CREAM,
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void createIntegration()}
                  disabled={integrationBusy || !siteIdReady}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: "none",
                    background: integrationBusy || !siteIdReady ? "#444" : CREAM,
                    color: INK,
                    fontWeight: 600,
                    cursor: integrationBusy || !siteIdReady ? "not-allowed" : "pointer",
                  }}
                >
                  POST /api/phase2/integrations
                </button>
                <button
                  type="button"
                  onClick={() => void validateIntegration()}
                  disabled={validateBusy || !integrationId}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: `1px solid ${HAIRLINE}`,
                    background: "transparent",
                    color: CREAM,
                    fontWeight: 600,
                    cursor: validateBusy || !integrationId ? "not-allowed" : "pointer",
                  }}
                >
                  Validate
                </button>
              </div>
              {integrationErr && (
                <p style={{ marginTop: 10, color: ERR, fontSize: 13 }} role="alert">
                  {integrationErr}
                </p>
              )}
              {integrationId && (
                <p style={{ marginTop: 10, fontSize: 13, color: MUTED }}>
                  Integration id: <code style={{ color: CREAM }}>{integrationId}</code>
                </p>
              )}
              {validateResult && (
                <p style={{ marginTop: 10, fontSize: 13, color: MUTED, whiteSpace: "pre-wrap" }}>
                  {validateResult}
                </p>
              )}
              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={goBack}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${HAIRLINE}`,
                    background: "transparent",
                    color: CREAM,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canProceedStep2}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "none",
                    background: canProceedStep2 ? CREAM : "#333",
                    color: canProceedStep2 ? INK : MUTED,
                    cursor: canProceedStep2 ? "pointer" : "not-allowed",
                    fontWeight: 600,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {stepIndex === 3 && (
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 600 }}>Estimate</h2>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
                Runs <code style={{ color: CREAM }}>POST /api/phase2/insights/run</code> with a rolling{" "}
                <strong>7-day</strong> window. Trustworthy and gate warnings come from the validation
                gate.
              </p>
              <button
                type="button"
                onClick={() => void runEstimate()}
                disabled={estimateBusy || !siteIdReady}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "none",
                  background: estimateBusy || !siteIdReady ? "#444" : CREAM,
                  color: INK,
                  fontWeight: 600,
                  cursor: estimateBusy || !siteIdReady ? "not-allowed" : "pointer",
                }}
              >
                {estimateBusy ? "Running…" : "Run 7-day estimate"}
              </button>
              {estimateErr && (
                <p style={{ marginTop: 10, color: ERR, fontSize: 13 }} role="alert">
                  {estimateErr}
                </p>
              )}
              {trustworthy !== null && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: `1px solid ${HAIRLINE}`,
                    background: trustworthy ? "rgba(34,197,94,0.12)" : "rgba(220,38,38,0.12)",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    Trustworthy gate: {trustworthy ? "passed" : "not met"}
                  </p>
                  {gateMessages.length > 0 && (
                    <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: MUTED }}>
                      {gateMessages.map((line, idx) => (
                        <li key={`g-${idx}`} style={{ marginBottom: 6 }}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!trustworthy && gateMessages.length === 0 && (
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: MUTED }}>
                      No detailed warnings returned; check data volume and configuration.
                    </p>
                  )}
                </div>
              )}
              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={goBack}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${HAIRLINE}`,
                    background: "transparent",
                    color: CREAM,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </section>

        <footer style={{ marginTop: 24, fontSize: 12, color: MUTED }}>
          Step {stepIndex + 1} of {STEPS.length}.
        </footer>
      </div>
    </main>
  );
}

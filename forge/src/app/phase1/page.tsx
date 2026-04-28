"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Site = {
  id: string;
  name: string;
  domain: string;
  provider: string;
};

type ReadinessItem = {
  category: string;
  status: string;
  evidenceCount: number;
};

type RecommendationItem = {
  id: string;
  title: string;
  summary: string;
  evidenceRefs: string[];
};

type RequestState = "idle" | "loading" | "success" | "error";

const INK = "#111111";
const MUTED = "#6B6B6B";
const CREAM = "#FAFAF8";
const HAIRLINE = "rgba(0,0,0,0.12)";

const PROVIDERS = ["shopify", "woocommerce", "custom", "other"];
const EVENT_TYPES = [
  "page_view",
  "product_view",
  "add_to_cart",
  "checkout_start",
  "purchase",
];

function toSite(item: unknown): Site | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const rawId = record.id ?? record.siteId ?? record.site_id;
  if (typeof rawId !== "string" && typeof rawId !== "number") return null;
  return {
    id: String(rawId),
    name: typeof record.name === "string" ? record.name : "Untitled Site",
    domain: typeof record.domain === "string" ? record.domain : "unknown-domain",
    provider: typeof record.provider === "string" ? record.provider : "unknown",
  };
}

function normalizeSites(payload: unknown): Site[] {
  if (Array.isArray(payload)) return payload.map(toSite).filter(Boolean) as Site[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.sites)) return record.sites.map(toSite).filter(Boolean) as Site[];
    if (Array.isArray(record.data)) return record.data.map(toSite).filter(Boolean) as Site[];
  }
  return [];
}

function normalizeReadiness(payload: unknown): ReadinessItem[] {
  const normalizeItem = (item: unknown): ReadinessItem | null => {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const category = record.category ?? record.name;
    if (typeof category !== "string") return null;
    const status = typeof record.status === "string" ? record.status : "unknown";
    const evidenceCountRaw =
      record.evidenceCount ?? record.evidence_count ?? record.evidence_count_total ?? 0;
    const evidenceCount =
      typeof evidenceCountRaw === "number"
        ? evidenceCountRaw
        : Number.parseInt(String(evidenceCountRaw), 10) || 0;
    return { category, status, evidenceCount };
  };

  if (Array.isArray(payload)) {
    return payload.map(normalizeItem).filter(Boolean) as ReadinessItem[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidate = record.readiness ?? record.data ?? record.categories;
    if (Array.isArray(candidate)) {
      return candidate.map(normalizeItem).filter(Boolean) as ReadinessItem[];
    }
    if (candidate && typeof candidate === "object") {
      return Object.entries(candidate).map(([category, value]) => {
        const entry = value as Record<string, unknown>;
        const status = typeof entry?.status === "string" ? entry.status : "unknown";
        const evidenceCountRaw =
          entry?.evidenceCount ?? entry?.evidence_count ?? entry?.evidence_count_total ?? 0;
        const evidenceCount =
          typeof evidenceCountRaw === "number"
            ? evidenceCountRaw
            : Number.parseInt(String(evidenceCountRaw), 10) || 0;
        return { category, status, evidenceCount };
      });
    }
  }

  return [];
}

function normalizeRecommendations(payload: unknown): RecommendationItem[] {
  const normalizeItem = (item: unknown, fallbackIndex: number): RecommendationItem | null => {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const idRaw = record.id ?? record.recommendationId ?? fallbackIndex;
    const titleRaw = record.title ?? record.name;
    const summaryRaw = record.summary ?? record.rationale ?? record.description;
    if (typeof titleRaw !== "string") return null;
    const refs = Array.isArray(record.evidenceRefs)
      ? record.evidenceRefs
      : Array.isArray(record.evidence_refs)
        ? record.evidence_refs
        : Array.isArray(record.evidence)
          ? record.evidence
          : [];
    return {
      id: String(idRaw),
      title: titleRaw,
      summary:
        typeof summaryRaw === "string"
          ? summaryRaw
          : "No summary available for this recommendation.",
      evidenceRefs: refs.map((ref) => String(ref)),
    };
  };

  let source: unknown[] = [];
  if (Array.isArray(payload)) {
    source = payload;
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.recommendations)) source = record.recommendations;
    else if (Array.isArray(record.data)) source = record.data;
    else if (Array.isArray(record.items)) source = record.items;
  }

  return source
    .map((item, index) => normalizeItem(item, index + 1))
    .filter(Boolean)
    .slice(0, 3) as RecommendationItem[];
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function requestJson(
  url: string,
  init?: RequestInit & { fallbackErrorMessage?: string }
): Promise<unknown> {
  const response = await fetch(url, init);
  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    const fallbackErrorMessage = init?.fallbackErrorMessage ?? "Request failed.";
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : fallbackErrorMessage;
    throw new Error(message);
  }
  return payload;
}

function statusBadge(status: string): { label: string; bg: string; fg: string; border: string } {
  const value = status.toLowerCase();
  if (value.includes("ready") || value.includes("good") || value.includes("pass")) {
    return { label: "Ready", bg: "rgba(22, 101, 52, 0.08)", fg: "#166534", border: "rgba(22, 101, 52, 0.2)" };
  }
  if (value.includes("partial") || value.includes("progress") || value.includes("warn")) {
    return { label: "Partial", bg: "rgba(180, 83, 9, 0.08)", fg: "#B45309", border: "rgba(180, 83, 9, 0.2)" };
  }
  if (value.includes("not") || value.includes("missing") || value.includes("fail")) {
    return { label: "Missing", bg: "rgba(154, 31, 42, 0.08)", fg: "#9A1F2A", border: "rgba(154, 31, 42, 0.2)" };
  }
  return { label: status || "Unknown", bg: "rgba(0,0,0,0.05)", fg: INK, border: "rgba(0,0,0,0.12)" };
}

export default function Phase1Page() {
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesState, setSitesState] = useState<RequestState>("loading");
  const [sitesError, setSitesError] = useState("");

  const [selectedSiteId, setSelectedSiteId] = useState("");

  const [createName, setCreateName] = useState("");
  const [createDomain, setCreateDomain] = useState("");
  const [createProvider, setCreateProvider] = useState(PROVIDERS[0]);
  const [createState, setCreateState] = useState<RequestState>("idle");
  const [createMessage, setCreateMessage] = useState("");

  const [eventCount, setEventCount] = useState(25);
  const [eventTypes, setEventTypes] = useState<string[]>(["page_view", "product_view", "add_to_cart"]);
  const [eventsState, setEventsState] = useState<RequestState>("idle");
  const [eventsMessage, setEventsMessage] = useState("");

  const [readinessItems, setReadinessItems] = useState<ReadinessItem[]>([]);
  const [readinessState, setReadinessState] = useState<RequestState>("idle");
  const [readinessError, setReadinessError] = useState("");

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [recommendationsState, setRecommendationsState] = useState<RequestState>("idle");
  const [recommendationsError, setRecommendationsError] = useState("");

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId]
  );

  const hasSites = sites.length > 0;
  const canRunSiteActions = Boolean(selectedSiteId);

  const loadSites = async (preferredSiteId?: string) => {
    setSitesState("loading");
    setSitesError("");
    try {
      const payload = await requestJson("/api/phase1/sites", {
        method: "GET",
        fallbackErrorMessage: "Unable to load sites.",
      });
      const normalized = normalizeSites(payload);
      setSites(normalized);
      setSitesState("success");
      if (normalized.length === 0) {
        setSelectedSiteId("");
        return;
      }
      const resolvedPreferred = preferredSiteId ?? selectedSiteId;
      const match = normalized.some((site) => site.id === resolvedPreferred);
      setSelectedSiteId(match ? resolvedPreferred : normalized[0].id);
    } catch (error) {
      setSitesState("error");
      setSitesError(error instanceof Error ? error.message : "Unable to load sites.");
    }
  };

  const loadReadiness = async (siteId: string) => {
    setReadinessState("loading");
    setReadinessError("");
    try {
      const payload = await requestJson("/api/phase1/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
        fallbackErrorMessage: "Unable to load readiness.",
      });
      setReadinessItems(normalizeReadiness(payload));
      setReadinessState("success");
    } catch (error) {
      setReadinessState("error");
      setReadinessError(error instanceof Error ? error.message : "Unable to load readiness.");
      setReadinessItems([]);
    }
  };

  const loadRecommendations = async (siteId: string) => {
    setRecommendationsState("loading");
    setRecommendationsError("");
    try {
      const payload = await requestJson("/api/phase1/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
        fallbackErrorMessage: "Unable to load recommendations.",
      });
      setRecommendations(normalizeRecommendations(payload));
      setRecommendationsState("success");
    } catch (error) {
      setRecommendationsState("error");
      setRecommendationsError(
        error instanceof Error ? error.message : "Unable to load recommendations."
      );
      setRecommendations([]);
    }
  };

  useEffect(() => {
    // Defer initial load to avoid synchronous setState calls in effect body.
    void Promise.resolve().then(() => {
      void loadSites();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;
    void Promise.resolve().then(() => {
      void loadReadiness(selectedSiteId);
      void loadRecommendations(selectedSiteId);
    });
  }, [selectedSiteId]);

  const onCreateSite = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateMessage("");

    if (!createName.trim() || !createDomain.trim()) {
      setCreateState("error");
      setCreateMessage("Name and domain are required.");
      return;
    }

    setCreateState("loading");
    try {
      const payload = await requestJson("/api/phase1/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          domain: createDomain.trim(),
          provider: createProvider,
        }),
        fallbackErrorMessage: "Unable to create site.",
      });

      const created = toSite(payload) ?? toSite((payload as { site?: unknown })?.site ?? null);
      await loadSites(created?.id);
      setCreateState("success");
      setCreateMessage(created ? `Created ${created.name}.` : "Site created.");
      setCreateName("");
      setCreateDomain("");
      setCreateProvider(PROVIDERS[0]);
    } catch (error) {
      setCreateState("error");
      setCreateMessage(error instanceof Error ? error.message : "Unable to create site.");
    }
  };

  const toggleEventType = (type: string) => {
    setEventTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );
  };

  const onGenerateEvents = async (event: React.FormEvent) => {
    event.preventDefault();
    setEventsMessage("");

    if (!selectedSiteId) {
      setEventsState("error");
      setEventsMessage("Choose a site before generating events.");
      return;
    }

    if (eventCount < 1 || eventCount > 5000) {
      setEventsState("error");
      setEventsMessage("Event count must be between 1 and 5000.");
      return;
    }

    if (eventTypes.length === 0) {
      setEventsState("error");
      setEventsMessage("Select at least one event type.");
      return;
    }

    setEventsState("loading");
    try {
      await requestJson("/api/phase1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSiteId,
          count: eventCount,
          eventTypes,
        }),
        fallbackErrorMessage: "Unable to ingest sample events.",
      });
      setEventsState("success");
      setEventsMessage(`Ingested ${eventCount} sample events.`);
      await Promise.all([loadReadiness(selectedSiteId), loadRecommendations(selectedSiteId)]);
    } catch (error) {
      setEventsState("error");
      setEventsMessage(
        error instanceof Error ? error.message : "Unable to ingest sample events."
      );
    }
  };

  return (
    <main
      style={{
        background: CREAM,
        minHeight: "100vh",
        color: INK,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <header
        style={{
          padding: "28px 24px",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <div
          style={{
            maxWidth: "1080px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: INK,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "6px",
                background: INK,
                display: "inline-block",
              }}
            />
            Forge
          </Link>
          <div
            style={{
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: MUTED,
              fontWeight: 700,
            }}
          >
            Phase 1 Operator Dashboard
          </div>
        </div>
      </header>

      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "32px 24px 64px" }}>
        <p
          style={{
            margin: "0 0 24px",
            color: MUTED,
            fontFamily: "var(--font-newsreader), Georgia, serif",
            fontStyle: "italic",
            fontSize: "18px",
          }}
        >
          Internal control panel for creating sites, generating event telemetry, and checking
          readiness output.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          <section
            style={{
              border: `1px solid ${HAIRLINE}`,
              borderRadius: "14px",
              padding: "20px",
              background: "rgba(255,255,255,0.78)",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: "20px", letterSpacing: "-0.02em" }}>
              Create Site
            </h2>
            <p style={{ margin: "0 0 16px", color: MUTED, fontSize: "14px" }}>
              Provision a site record for Phase 1 simulation.
            </p>
            <form onSubmit={onCreateSite}>
              <label style={{ display: "block", marginBottom: "6px", color: MUTED, fontSize: "13px" }}>
                Name
              </label>
              <input
                className="input-field"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Acme Store"
                style={{ marginBottom: "12px", boxSizing: "border-box" }}
              />

              <label style={{ display: "block", marginBottom: "6px", color: MUTED, fontSize: "13px" }}>
                Domain
              </label>
              <input
                className="input-field"
                value={createDomain}
                onChange={(e) => setCreateDomain(e.target.value)}
                placeholder="acme.com"
                style={{ marginBottom: "12px", boxSizing: "border-box" }}
              />

              <label style={{ display: "block", marginBottom: "6px", color: MUTED, fontSize: "13px" }}>
                Provider
              </label>
              <select
                className="input-field"
                value={createProvider}
                onChange={(e) => setCreateProvider(e.target.value)}
                style={{ marginBottom: "14px", boxSizing: "border-box" }}
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={createState === "loading"}
                style={{
                  width: "100%",
                  borderRadius: "999px",
                  border: "none",
                  background: createState === "loading" ? "#444" : INK,
                  color: CREAM,
                  padding: "13px 18px",
                  cursor: createState === "loading" ? "wait" : "pointer",
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                {createState === "loading" ? "Creating..." : "Create Site"}
              </button>
            </form>
            {createMessage && (
              <p
                style={{
                  margin: "12px 0 0",
                  color: createState === "error" ? "#9A1F2A" : "#166534",
                  fontSize: "13px",
                }}
                role="status"
              >
                {createMessage}
              </p>
            )}
          </section>

          <section
            style={{
              border: `1px solid ${HAIRLINE}`,
              borderRadius: "14px",
              padding: "20px",
              background: "rgba(255,255,255,0.78)",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: "20px", letterSpacing: "-0.02em" }}>
              Site Selector
            </h2>
            <p style={{ margin: "0 0 16px", color: MUTED, fontSize: "14px" }}>
              Choose the active site for event generation and analytics.
            </p>

            {sitesState === "loading" && <p style={{ margin: "0 0 12px", color: MUTED }}>Loading sites...</p>}
            {sitesState === "error" && (
              <p style={{ margin: "0 0 12px", color: "#9A1F2A" }} role="alert">
                {sitesError}
              </p>
            )}

            <select
              className="input-field"
              disabled={!hasSites}
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              style={{ boxSizing: "border-box", marginBottom: "10px" }}
            >
              {!hasSites && <option value="">No sites available</option>}
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.domain})
                </option>
              ))}
            </select>

            {selectedSite ? (
              <p style={{ margin: "0 0 12px", color: MUTED, fontSize: "13px" }}>
                Active: {selectedSite.name} · {selectedSite.provider} · {selectedSite.domain}
              </p>
            ) : (
              <p style={{ margin: "0 0 12px", color: MUTED, fontSize: "13px" }}>
                Create a site to begin simulation.
              </p>
            )}

            <button
              type="button"
              onClick={() => loadSites(selectedSiteId)}
              disabled={sitesState === "loading"}
              style={{
                width: "100%",
                borderRadius: "999px",
                border: `1px solid ${HAIRLINE}`,
                background: "#FFFFFF",
                color: INK,
                padding: "12px 14px",
                cursor: sitesState === "loading" ? "wait" : "pointer",
                fontWeight: 500,
                fontFamily: "inherit",
              }}
            >
              Refresh Sites
            </button>
          </section>
        </div>

        <section
          style={{
            border: `1px solid ${HAIRLINE}`,
            borderRadius: "14px",
            padding: "20px",
            background: "rgba(255,255,255,0.78)",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: "20px", letterSpacing: "-0.02em" }}>
            Event Generator
          </h2>
          <p style={{ margin: "0 0 16px", color: MUTED, fontSize: "14px" }}>
            Simulate event traffic for the selected site.
          </p>
          <form onSubmit={onGenerateEvents}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <div>
                <label style={{ display: "block", marginBottom: "6px", color: MUTED, fontSize: "13px" }}>
                  Event Count
                </label>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  max={5000}
                  value={eventCount}
                  onChange={(e) => setEventCount(Number.parseInt(e.target.value || "0", 10))}
                  style={{ boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", color: MUTED, fontSize: "13px" }}>
                  Event Types
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {EVENT_TYPES.map((type) => {
                    const selected = eventTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleEventType(type)}
                        style={{
                          borderRadius: "999px",
                          border: `1px solid ${selected ? INK : HAIRLINE}`,
                          background: selected ? INK : "#FFFFFF",
                          color: selected ? CREAM : INK,
                          padding: "8px 12px",
                          fontSize: "12px",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canRunSiteActions || eventsState === "loading"}
              style={{
                borderRadius: "999px",
                border: "none",
                background: !canRunSiteActions || eventsState === "loading" ? "#444" : INK,
                color: CREAM,
                padding: "12px 20px",
                cursor: !canRunSiteActions || eventsState === "loading" ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              {eventsState === "loading" ? "Ingesting..." : "Ingest Sample Events"}
            </button>
          </form>
          {eventsMessage && (
            <p
              style={{
                margin: "12px 0 0",
                color: eventsState === "error" ? "#9A1F2A" : "#166534",
                fontSize: "13px",
              }}
              role="status"
            >
              {eventsMessage}
            </p>
          )}
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          <section
            style={{
              border: `1px solid ${HAIRLINE}`,
              borderRadius: "14px",
              padding: "20px",
              background: "rgba(255,255,255,0.78)",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: "20px", letterSpacing: "-0.02em" }}>
              Readiness by Category
            </h2>
            <p style={{ margin: "0 0 16px", color: MUTED, fontSize: "14px" }}>
              Category status and evidence coverage.
            </p>

            {readinessState === "loading" && <p style={{ margin: 0, color: MUTED }}>Loading readiness...</p>}
            {readinessState === "error" && (
              <p style={{ margin: 0, color: "#9A1F2A" }} role="alert">
                {readinessError}
              </p>
            )}
            {readinessState !== "loading" && readinessItems.length === 0 && (
              <p style={{ margin: 0, color: MUTED }}>
                {canRunSiteActions
                  ? "No readiness data yet. Ingest events to generate coverage."
                  : "Select a site to view readiness."}
              </p>
            )}

            <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
              {readinessItems.map((item) => {
                const badge = statusBadge(item.status);
                return (
                  <article
                    key={`${item.category}-${item.status}`}
                    style={{
                      border: `1px solid ${HAIRLINE}`,
                      borderRadius: "12px",
                      padding: "12px 14px",
                      background: "#FFFFFF",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: "15px", letterSpacing: "-0.01em" }}>
                        {item.category}
                      </h3>
                      <span
                        style={{
                          display: "inline-block",
                          borderRadius: "999px",
                          border: `1px solid ${badge.border}`,
                          background: badge.bg,
                          color: badge.fg,
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          padding: "4px 8px",
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: MUTED, fontSize: "13px" }}>
                      Evidence count: {item.evidenceCount}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <section
            style={{
              border: `1px solid ${HAIRLINE}`,
              borderRadius: "14px",
              padding: "20px",
              background: "rgba(255,255,255,0.78)",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: "20px", letterSpacing: "-0.02em" }}>
              Top Recommendations
            </h2>
            <p style={{ margin: "0 0 16px", color: MUTED, fontSize: "14px" }}>
              Highest-priority recommendations with evidence references.
            </p>

            {recommendationsState === "loading" && (
              <p style={{ margin: 0, color: MUTED }}>Loading recommendations...</p>
            )}
            {recommendationsState === "error" && (
              <p style={{ margin: 0, color: "#9A1F2A" }} role="alert">
                {recommendationsError}
              </p>
            )}
            {recommendationsState !== "loading" && recommendations.length === 0 && (
              <p style={{ margin: 0, color: MUTED }}>
                {canRunSiteActions
                  ? "No recommendations yet. Add telemetry to generate suggestions."
                  : "Select a site to view recommendations."}
              </p>
            )}

            <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
              {recommendations.map((item) => (
                <article
                  key={item.id}
                  style={{
                    border: `1px solid ${HAIRLINE}`,
                    borderRadius: "12px",
                    padding: "12px 14px",
                    background: "#FFFFFF",
                  }}
                >
                  <h3 style={{ margin: "0 0 8px", fontSize: "15px", letterSpacing: "-0.01em" }}>
                    {item.title}
                  </h3>
                  <p style={{ margin: "0 0 10px", color: MUTED, fontSize: "13px", lineHeight: 1.5 }}>
                    {item.summary}
                  </p>
                  <p style={{ margin: 0, color: INK, fontSize: "12px" }}>
                    Evidence refs:{" "}
                    {item.evidenceRefs.length > 0 ? item.evidenceRefs.slice(0, 4).join(", ") : "None"}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

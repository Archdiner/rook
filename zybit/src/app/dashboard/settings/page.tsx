"use client";

/**
 * Dashboard Settings / Billing page.
 *
 * Shows: current plan, usage bars, upgrade & manage buttons.
 */

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const INK = "#111111";
const MUTED = "#6B6B6B";
const HAIRLINE = "rgba(0,0,0,0.08)";
const CREAM = "#FAFAF8";
const SUBTLE = "rgba(0,0,0,0.04)";

type PlanId = "starter" | "growth" | "scale" | "enterprise";

const PLAN_DISPLAY: Record<
  PlanId,
  { name: string; price: string; priceNote: string }
> = {
  starter: { name: "Starter", price: "$199", priceNote: "/mo" },
  growth: { name: "Growth", price: "$599", priceNote: "/mo" },
  scale: { name: "Scale", price: "$1,499", priceNote: "/mo" },
  enterprise: { name: "Enterprise", price: "Custom", priceNote: "" },
};

const PLAN_LIMITS: Record<
  PlanId,
  { sites: number; eventsPerMonth: number; concurrentExperiments: number }
> = {
  starter: { sites: 1, eventsPerMonth: 100_000, concurrentExperiments: 2 },
  growth: { sites: 3, eventsPerMonth: 500_000, concurrentExperiments: 10 },
  scale: {
    sites: 10,
    eventsPerMonth: 2_000_000,
    concurrentExperiments: Infinity,
  },
  enterprise: {
    sites: Infinity,
    eventsPerMonth: Infinity,
    concurrentExperiments: Infinity,
  },
};

const UPGRADE_ORDER: PlanId[] = ["starter", "growth", "scale"];

function formatNum(n: number): string {
  if (n === Infinity) return "Unlimited";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
}

function UsageBar({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const pct = limit === Infinity ? 0 : Math.min(100, (current / limit) * 100);
  const overThreshold = pct >= 80;
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, color: MUTED }}>
          {formatNum(current)} / {formatNum(limit)}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: HAIRLINE,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: overThreshold ? "#DC2626" : INK,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();

  const clerkEnabled = useMemo(
    () => process.env.NEXT_PUBLIC_FORGE_CLERK_ENABLED === "true",
    []
  );
  const defaultOrg = useMemo(
    () => process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "org_default",
    []
  );

  const [plan] = useState<PlanId>("starter");
  const [usage, setUsage] = useState({
    eventsIngested: 0,
    snapshotsTaken: 0,
    insightsRuns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const checkoutStatus = searchParams.get("checkout");

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

  useEffect(() => {
    async function load() {
      try {
        const [usageRes] = await Promise.allSettled([
          apiFetch("/api/billing/usage"),
        ]);

        if (usageRes.status === "fulfilled" && usageRes.value.ok) {
          const json = (await usageRes.value.json()) as {
            success?: boolean;
            data?: { eventsIngested?: number; snapshotsTaken?: number; insightsRuns?: number };
          };
          if (json.success && json.data) {
            setUsage({
              eventsIngested: json.data.eventsIngested ?? 0,
              snapshotsTaken: json.data.snapshotsTaken ?? 0,
              insightsRuns: json.data.insightsRuns ?? 0,
            });
          }
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleManage() {
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/billing/portal", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { url?: string };
      };
      if (json.success && json.data?.url) {
        window.location.href = json.data.url;
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpgrade(targetPlan: PlanId) {
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: targetPlan }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { url?: string };
      };
      if (json.success && json.data?.url) {
        window.location.href = json.data.url;
      }
    } finally {
      setActionLoading(false);
    }
  }

  const limits = PLAN_LIMITS[plan];
  const display = PLAN_DISPLAY[plan];
  const nextPlan = UPGRADE_ORDER[UPGRADE_ORDER.indexOf(plan) + 1] as
    | PlanId
    | undefined;

  return (
    <div
      style={{
        padding: "32px clamp(24px, 4vw, 48px)",
        maxWidth: 720,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        color: INK,
      }}
    >
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        Settings
      </p>
      <h1
        style={{
          margin: "0 0 28px",
          fontSize: "clamp(22px, 3vw, 28px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        Billing
      </h1>

      {checkoutStatus === "success" && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 20,
            borderRadius: 10,
            background: "rgba(22,163,74,0.08)",
            border: "1px solid rgba(22,163,74,0.15)",
            fontSize: 14,
            color: "#065F46",
          }}
        >
          Subscription activated. Your plan has been updated.
        </div>
      )}

      {checkoutStatus === "cancel" && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 20,
            borderRadius: 10,
            background: SUBTLE,
            border: `1px solid ${HAIRLINE}`,
            fontSize: 14,
            color: MUTED,
          }}
        >
          Checkout was cancelled. No changes were made.
        </div>
      )}

      {loading ? (
        <p style={{ color: MUTED, fontSize: 14 }}>Loading...</p>
      ) : (
        <>
          {/* Current plan card */}
          <div
            style={{
              backgroundColor: "#fff",
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 14,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  Current plan
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {display.name}{" "}
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 400,
                      color: MUTED,
                    }}
                  >
                    {display.price}
                    {display.priceNote}
                  </span>
                </p>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void handleManage()}
                  disabled={actionLoading}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 999,
                    border: `1px solid ${HAIRLINE}`,
                    background: "transparent",
                    color: INK,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: actionLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Manage subscription
                </button>
                {nextPlan && (
                  <button
                    type="button"
                    onClick={() => void handleUpgrade(nextPlan)}
                    disabled={actionLoading}
                    style={{
                      padding: "9px 18px",
                      borderRadius: 999,
                      border: "none",
                      background: INK,
                      color: CREAM,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: actionLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    Upgrade to {PLAN_DISPLAY[nextPlan].name}
                  </button>
                )}
              </div>
            </div>

            {/* Usage bars */}
            <UsageBar
              label="Events this month"
              current={usage.eventsIngested}
              limit={limits.eventsPerMonth}
            />
            <UsageBar
              label="Sites"
              current={0}
              limit={limits.sites}
            />
            <UsageBar
              label="Concurrent experiments"
              current={0}
              limit={limits.concurrentExperiments}
            />
          </div>

          {/* Plan comparison strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            {(["starter", "growth", "scale", "enterprise"] as PlanId[]).map(
              (pid) => {
                const d = PLAN_DISPLAY[pid];
                const isCurrent = pid === plan;
                return (
                  <div
                    key={pid}
                    style={{
                      backgroundColor: isCurrent ? "rgba(0,0,0,0.04)" : "#fff",
                      border: `1px solid ${isCurrent ? INK : HAIRLINE}`,
                      borderRadius: 12,
                      padding: "16px 14px",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 4px",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: MUTED,
                      }}
                    >
                      {d.name}
                    </p>
                    <p
                      style={{
                        margin: "0 0 10px",
                        fontSize: 20,
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {d.price}
                      {d.priceNote && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 400,
                            color: MUTED,
                          }}
                        >
                          {d.priceNote}
                        </span>
                      )}
                    </p>
                    {isCurrent ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: MUTED,
                        }}
                      >
                        Current
                      </span>
                    ) : pid !== "enterprise" ? (
                      <button
                        type="button"
                        onClick={() => void handleUpgrade(pid)}
                        disabled={actionLoading}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 999,
                          border: `1px solid ${HAIRLINE}`,
                          background: "transparent",
                          fontSize: 12,
                          fontWeight: 600,
                          color: INK,
                          cursor: actionLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        Select
                      </button>
                    ) : (
                      <a
                        href="mailto:sales@zybit.dev"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: MUTED,
                          textDecoration: "none",
                        }}
                      >
                        Contact sales
                      </a>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
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
          Loading...
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type PlanId = "starter" | "growth" | "scale" | "enterprise";

const PLAN_DISPLAY: Record<PlanId, { name: string; price: string; priceNote: string }> = {
  starter: { name: "Starter", price: "$199", priceNote: "/mo" },
  growth: { name: "Growth", price: "$599", priceNote: "/mo" },
  scale: { name: "Scale", price: "$1,499", priceNote: "/mo" },
  enterprise: { name: "Enterprise", price: "Custom", priceNote: "" },
};

const PLAN_LIMITS: Record<PlanId, { sites: number; eventsPerMonth: number; concurrentExperiments: number }> = {
  starter: { sites: 1, eventsPerMonth: 100_000, concurrentExperiments: 2 },
  growth: { sites: 3, eventsPerMonth: 500_000, concurrentExperiments: 10 },
  scale: { sites: 10, eventsPerMonth: 2_000_000, concurrentExperiments: Infinity },
  enterprise: { sites: Infinity, eventsPerMonth: Infinity, concurrentExperiments: Infinity },
};

const UPGRADE_ORDER: PlanId[] = ["starter", "growth", "scale"];

function formatNum(n: number): string {
  if (n === Infinity) return "Unlimited";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
}

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number }) {
  const pct = limit === Infinity ? 0 : Math.min(100, (current / limit) * 100);
  const overThreshold = pct >= 80;
  
  return (
    <div className="mb-6">
      <div className="flex justify-between items-end mb-3">
        <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#6B6B6B]">{label}</span>
        <span className="text-[15px] font-bold text-[#111] tabular-nums">
          {formatNum(current)} <span className="text-[#6B6B6B] font-medium">/ {formatNum(limit)}</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-black/[0.04] overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            overThreshold ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]" : "bg-[#111]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();

  const clerkEnabled = useMemo(() => process.env.NEXT_PUBLIC_FORGE_CLERK_ENABLED === "true", []);
  const defaultOrg = useMemo(() => process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "org_default", []);

  const [plan] = useState<PlanId>("starter");
  const [usage, setUsage] = useState({ eventsIngested: 0, snapshotsTaken: 0, insightsRuns: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const checkoutStatus = searchParams.get("checkout");

  const apiFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers((init?.headers as Record<string, string> | undefined) ?? {});
      if (!clerkEnabled) headers.set("x-org-id", defaultOrg);
      if (!headers.has("Content-Type") && init?.method && !["GET", "HEAD"].includes(init.method) && init.body) {
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
        const [usageRes] = await Promise.allSettled([apiFetch("/api/billing/usage")]);
        if (usageRes.status === "fulfilled" && usageRes.value.ok) {
          const json = (await usageRes.value.json()) as any;
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
  }, [apiFetch]);

  async function handleManage() {
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/billing/portal", { method: "POST", body: JSON.stringify({}) });
      const json = await res.json();
      if (json.success && json.data?.url) window.location.href = json.data.url;
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
      const json = await res.json();
      if (json.success && json.data?.url) window.location.href = json.data.url;
    } finally {
      setActionLoading(false);
    }
  }

  const limits = PLAN_LIMITS[plan];
  const display = PLAN_DISPLAY[plan];
  const nextPlan = UPGRADE_ORDER[UPGRADE_ORDER.indexOf(plan) + 1] as PlanId | undefined;

  return (
    <div className="sans-text max-w-[800px] w-full pt-8 pb-32">
      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B6B6B] mb-4">
        Settings
      </p>
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-[#111] mb-12">
        Billing & Usage
      </h1>

      {checkoutStatus === "success" && (
        <div className="mb-10 p-6 rounded-2xl bg-green-50 border border-green-100 flex items-center gap-4 animate-[fadeIn_0.5s_ease-out]">
          <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <p className="font-bold text-green-900 text-lg tracking-tight mb-1">Subscription active</p>
            <p className="text-sm text-green-800/80">Your plan has been successfully upgraded.</p>
          </div>
        </div>
      )}

      {checkoutStatus === "cancel" && (
        <div className="mb-10 p-4 rounded-xl bg-black/[0.02] border border-black/[0.04] text-sm text-[#6B6B6B] font-medium">
          Checkout was cancelled. No changes were made to your subscription.
        </div>
      )}

      {loading ? (
        <div className="flex gap-2 items-center text-[#6B6B6B] py-12">
          <div className="w-5 h-5 border-2 border-[#6B6B6B] border-r-transparent rounded-full animate-spin" />
          <span className="font-medium tracking-tight">Loading usage data...</span>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Current plan card */}
          <div className="relative bg-white rounded-[2rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.04] overflow-hidden group">
            {/* Subtle glow effect behind current plan */}
            <div className="absolute -inset-1 bg-gradient-to-r from-transparent via-[#111]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-xl pointer-events-none" />
            
            <div className="relative flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-12">
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B6B6B] mb-4">
                  Active Plan
                </p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-[#111]">
                    {display.name}
                  </h2>
                  <span className="text-lg md:text-xl font-medium text-[#6B6B6B]">
                    {display.price}{display.priceNote}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleManage}
                  disabled={actionLoading}
                  className="px-6 py-3 rounded-full border border-black/[0.08] bg-transparent text-sm font-bold text-[#111] transition-colors hover:bg-black/[0.02] disabled:opacity-50"
                >
                  Manage portal
                </button>
                {nextPlan && (
                  <button
                    type="button"
                    onClick={() => handleUpgrade(nextPlan)}
                    disabled={actionLoading}
                    className="px-6 py-3 rounded-full border border-transparent bg-[#111] text-[#FAFAF8] text-sm font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    Upgrade to {PLAN_DISPLAY[nextPlan].name}
                  </button>
                )}
              </div>
            </div>

            <div className="relative p-6 rounded-[1.5rem] bg-[#FAFAF8] border border-black/[0.04]">
              <UsageBar label="Events this month" current={usage.eventsIngested} limit={limits.eventsPerMonth} />
              <UsageBar label="Connected Sites" current={0} limit={limits.sites} />
              <UsageBar label="Concurrent Experiments" current={0} limit={limits.concurrentExperiments} />
            </div>
          </div>

          {/* Plan comparison strip */}
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-[#111] mb-6">Available Tiers</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(["starter", "growth", "scale", "enterprise"] as PlanId[]).map((pid) => {
                const d = PLAN_DISPLAY[pid];
                const isCurrent = pid === plan;
                return (
                  <div
                    key={pid}
                    className={`relative p-6 rounded-2xl flex flex-col transition-all duration-300 ${
                      isCurrent
                        ? "bg-[#111] text-[#FAFAF8] shadow-xl"
                        : "bg-white border border-black/[0.06] hover:border-black/[0.15] hover:shadow-lg"
                    }`}
                  >
                    <div className="mb-8">
                      <p className={`text-[11px] font-bold tracking-[0.15em] uppercase mb-2 ${isCurrent ? "text-[#A0A0A0]" : "text-[#6B6B6B]"}`}>
                        {d.name}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold tracking-tighter">
                          {d.price}
                        </span>
                        {d.priceNote && (
                          <span className={`text-sm font-medium ${isCurrent ? "text-[#A0A0A0]" : "text-[#6B6B6B]"}`}>
                            {d.priceNote}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto">
                      {isCurrent ? (
                        <div className="w-full text-center py-2.5 rounded-full bg-white/10 text-[13px] font-bold text-white tracking-wide">
                          Current Plan
                        </div>
                      ) : pid !== "enterprise" ? (
                        <button
                          type="button"
                          onClick={() => handleUpgrade(pid)}
                          disabled={actionLoading}
                          className="w-full text-center py-2.5 rounded-full border border-black/[0.1] bg-transparent text-[13px] font-bold text-[#111] transition-colors hover:bg-black/[0.04] disabled:opacity-50"
                        >
                          Select
                        </button>
                      ) : (
                        <a
                          href="mailto:sales@zybit.dev"
                          className="block w-full text-center py-2.5 rounded-full border border-transparent bg-transparent text-[13px] font-bold text-[#6B6B6B] hover:text-[#111] transition-colors"
                        >
                          Contact sales
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-[#111] border-r-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RunInsightsButtonProps {
  siteId: string;
  orgId: string;
}

export default function RunInsightsButton({ siteId, orgId }: RunInsightsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/findings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId, organizationId: orgId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? "Insights run failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={loading}
        className="flex items-center gap-2 bg-[#111] text-[#FAFAF8] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.08em] hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Running…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 1v3M7 10v3M1 7h3M10 7h3M2.93 2.93l2.12 2.12M8.95 8.95l2.12 2.12M2.93 11.07l2.12-2.12M8.95 5.05l2.12-2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Run insights
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

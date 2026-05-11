"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFindingStatusAction } from "@/app/app/findings/actions";

interface Props {
  findingId: string;
  currentStatus: "open" | "approved";
}

export default function FindingRowActions({ findingId, currentStatus }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function act(e: React.MouseEvent, status: "approved" | "dismissed") {
    e.preventDefault(); // don't navigate the parent Link
    e.stopPropagation();
    setLoading(status);
    try {
      await updateFindingStatusAction(findingId, status);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-1 bg-white border border-black/[0.07] rounded-xl shadow-sm px-1.5 py-1.5">
      {currentStatus === "open" && (
        <button
          type="button"
          onClick={(e) => act(e, "approved")}
          disabled={loading !== null}
          title="Approve"
          className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
        >
          {loading === "approved" ? "…" : "Approve"}
        </button>
      )}
      <button
        type="button"
        onClick={(e) => act(e, "dismissed")}
        disabled={loading !== null}
        title="Dismiss"
        className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] rounded-lg text-[#6B6B6B] hover:text-[#111] hover:bg-black/[0.04] disabled:opacity-40 transition-colors"
      >
        {loading === "dismissed" ? "…" : "Dismiss"}
      </button>
    </div>
  );
}

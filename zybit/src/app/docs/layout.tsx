import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Zybit — API Reference",
  description:
    "Phase 1 HTTP API for sites, events, readiness, recommendations, sufficiency, and insights. Same deployment as the Zybit app — no separate backend.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return children;
}

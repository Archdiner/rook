"use client";

import Link from "next/link";
import { useState } from "react";
import { ForgeDocsParticleCanvas } from "@/components/forge-particle-background";

const ENDPOINTS: { method: string; path: string; note: string }[] = [
  { method: "GET", path: "/api/phase1/health", note: "Service health and capability flags." },
  { method: "GET", path: "/api/phase1/sites", note: "List sites for the resolved organization." },
  { method: "POST", path: "/api/phase1/sites", note: "Create a site (name, domain, analytics provider)." },
  { method: "POST", path: "/api/phase1/events", note: "Ingest a behavioral event for a site." },
  { method: "GET", path: "/api/phase1/readiness", note: "Readiness snapshot + totals (requires siteId query)." },
  { method: "POST", path: "/api/phase1/readiness", note: "Same as GET with siteId in JSON body." },
  { method: "GET", path: "/api/phase1/recommendations", note: "Heuristic recommendations for a site." },
  { method: "POST", path: "/api/phase1/sufficiency", note: "Evaluate sufficiency from evidence aggregates." },
  { method: "POST", path: "/api/phase1/insights", note: "Rank insight findings from structured aggregates." },
];

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy", e);
    }
  };

  return (
    <div className="relative group mb-4">
      <pre className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-[#111/[0.035]] px-5 py-4 text-left font-mono text-[12px] leading-[1.8] text-[#111] md:text-[13px]">
        {children.trim()}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 rounded-md bg-white border border-black/[0.08] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[#111] shadow-sm"
        aria-label="Copy code"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function DocsPage() {
  return (
    <main className="relative min-h-[220vh] w-full bg-[#FAFAF8] text-[#111]">
      <header className="fixed top-0 left-0 w-full z-50 flex flex-wrap items-center justify-between gap-y-4 px-6 py-6 pointer-events-auto backdrop-blur-md bg-[rgba(250,250,248,0.85)] border-b border-black/[0.04]">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <div className="h-6 w-6 rounded-md bg-[#111]" />
          <span className="sans-text text-xl font-bold tracking-tight text-[#111]">Forge</span>
        </Link>
        <nav
          className="flex flex-wrap items-center justify-end gap-4 md:gap-8 sans-text"
          aria-label="Primary"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#111]">API</span>
          <Link
            href="/discovery"
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] transition-colors hover:text-[#111]"
          >
            Discovery
          </Link>
          <Link
            href="/phase1"
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] transition-colors hover:text-[#111]"
          >
            Phase 1
          </Link>
        </nav>
        <div className="hidden lg:block sans-text text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">
          API Reference
        </div>
      </header>

      <ForgeDocsParticleCanvas />

      <article className="relative z-10 mx-auto max-w-[720px] px-6 pb-32 pt-28 md:px-10 md:pt-36">
        <p className="sans-text mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-[#6B6B6B]">
          Phase 1
        </p>
        <h1 className="sans-text mb-6 text-[2.25rem] font-bold leading-[0.95] tracking-tighter text-[#111] md:text-6xl">
          API reference
        </h1>
        <p
          className="mb-14 font-[family-name:var(--font-newsreader)] text-lg leading-[1.8] text-[#6B6B6B] md:text-xl"
          style={{ fontStyle: "normal" }}
        >
          All routes run on the same Forge deployment as this site — there is no separate backend service.
          Use HTTPS JSON; configure organization context for multi-tenant setups.
        </p>

        <section className="mb-14 rounded-[28px] border border-black/[0.06] bg-[rgba(250,250,248,0.78)] p-8 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.12)] backdrop-blur-xl md:p-10">
          <h2 className="sans-text mb-4 text-xl font-bold tracking-tight text-[#111] md:text-2xl">Base URL</h2>
          <p className="sans-text mb-4 text-sm leading-[1.8] text-[#6B6B6B] md:text-base">
            Use your deployment origin (for example{" "}
            <code className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[13px] text-[#111]">
              https://your-app.vercel.app
            </code>
            ). Paths below are rooted at <code className="font-mono text-[13px] text-[#111]">/</code>.
          </p>
          <CodeBlock>{`export BASE_URL="https://your-deployment.vercel.app"`}</CodeBlock>
        </section>

        <section className="mb-14 rounded-[28px] border border-black/[0.06] bg-[rgba(250,250,248,0.78)] p-8 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.12)] backdrop-blur-xl md:p-10">
          <h2 className="sans-text mb-4 text-xl font-bold tracking-tight text-[#111] md:text-2xl">
            Organization context
          </h2>
          <ul className="sans-text mb-6 list-disc space-y-2 pl-5 text-sm leading-[1.8] text-[#6B6B6B] md:text-base">
            <li>
              Prefer header{" "}
              <code className="rounded bg-black/[0.06] px-1 font-mono text-[13px] text-[#111]">x-org-id</code>.
            </li>
            <li>
              In dev mode, query{" "}
              <code className="font-mono text-[13px]">organizationId</code> or body fields may apply — see{" "}
              <code className="font-mono text-[13px]">PHASE1_ORG_IDENTITY_MODE</code> in README.
            </li>
            <li>
              Production-style deployments often set{" "}
              <code className="font-mono text-[13px]">header_required</code> so every request carries{" "}
              <code className="font-mono text-[13px]">x-org-id</code>.
            </li>
          </ul>
        </section>

        <section className="mb-14 rounded-[28px] border border-black/[0.06] bg-[rgba(250,250,248,0.78)] p-8 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.12)] backdrop-blur-xl md:p-10">
          <h2 className="sans-text mb-6 text-xl font-bold tracking-tight text-[#111] md:text-2xl">Endpoints</h2>
          <div className="flex flex-col divide-y divide-black/[0.06]">
            {ENDPOINTS.map((row) => (
              <div
                key={`${row.method}-${row.path}`}
                className="flex flex-col gap-2 py-5 first:pt-0 md:flex-row md:items-start md:justify-between md:gap-8"
              >
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <span className="sans-text rounded-full bg-[#111] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FAFAF8]">
                    {row.method}
                  </span>
                  <code className="break-all font-mono text-[13px] text-[#111]">{row.path}</code>
                </div>
                <p className="sans-text text-sm leading-[1.8] text-[#6B6B6B] md:max-w-[340px] md:text-right">
                  {row.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14 rounded-[28px] border border-black/[0.06] bg-[rgba(250,250,248,0.78)] p-8 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.12)] backdrop-blur-xl md:p-10">
          <h2 className="sans-text mb-6 text-xl font-bold tracking-tight text-[#111] md:text-2xl">Quick checks</h2>
          <CodeBlock>{`curl -s "$BASE_URL/api/phase1/health"`}</CodeBlock>
          <p className="sans-text mt-6 mb-4 text-sm text-[#6B6B6B]">Create a site (example body):</p>
          <CodeBlock>{`curl -s -X POST "$BASE_URL/api/phase1/sites" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Demo","domain":"example.com","analyticsProvider":"shopify"}'`}</CodeBlock>
          <p className="sans-text mt-6 mb-4 text-sm text-[#6B6B6B]">Readiness (replace site id):</p>
          <CodeBlock>{`curl -s "$BASE_URL/api/phase1/readiness?siteId=YOUR_SITE_ID"`}</CodeBlock>
        </section>

        <p className="font-[family-name:var(--font-newsreader)] text-center text-sm italic text-[#6B6B6B]">
          Full env matrix:{" "}
          <a
            href="https://github.com/Archdiner/rook/blob/main/forge/README.md"
            className="text-[#111] underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            forge/README.md
          </a>
          {" · "}
          Product narrative (Phases 0–4):{" "}
          <a
            href="https://github.com/Archdiner/rook/blob/main/forge/docs/PRODUCT_PRD.md"
            className="text-[#111] underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            forge/docs/PRODUCT_PRD.md
          </a>
        </p>
      </article>
    </main>
  );
}

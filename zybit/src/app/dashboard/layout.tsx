"use client";

/**
 * Dashboard layout — persistent sidebar nav + main content.
 * Follows the site's established design language: #FAFAF8 cream, #111 ink,
 * hairline borders, Inter type, pill buttons. No dark mode.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";
import { Logo } from "@/components/logo";

const CREAM = "#FAFAF8";
const INK = "#111111";
const MUTED = "#6B6B6B";
const HAIRLINE = "rgba(0,0,0,0.08)";
const ACTIVE_BG = "rgba(0,0,0,0.05)";

type NavLink = { href: string; label: string; exact?: boolean };

const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Cockpit", exact: true },
  { href: "/dashboard/findings", label: "Findings" },
  { href: "/dashboard/experiments", label: "Experiments" },
  { href: "/dashboard/connect", label: "Connect" },
];

function SidebarInner({ siteId }: { siteId: string }) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  function withSite(href: string) {
    return siteId ? `${href}?siteId=${siteId}` : href;
  }

  return (
    <aside
      style={{
        width: "220px",
        minWidth: "220px",
        borderRight: `1px solid ${HAIRLINE}`,
        backgroundColor: CREAM,
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "0 20px 24px", borderBottom: `1px solid ${HAIRLINE}` }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: INK,
          }}
        >
          <Logo style={{ width: "22px", height: "22px", color: INK }} />
          <span
            style={{
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
            }}
          >
            Zybit
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav
        style={{ padding: "16px 12px", flex: 1 }}
        aria-label="Dashboard navigation"
      >
        {NAV_LINKS.map(({ href, label, exact }) => {
          const active = isActive(href, exact as boolean | undefined);
          return (
            <Link
              key={href}
              href={withSite(href)}
              style={{
                display: "block",
                padding: "8px 10px",
                borderRadius: "8px",
                marginBottom: "2px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: active ? 600 : 400,
                color: active ? INK : MUTED,
                backgroundColor: active ? ACTIVE_BG : "transparent",
                transition: "background 0.1s, color 0.1s",
                fontFamily: "var(--font-inter), system-ui, sans-serif",
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom links */}
      <div
        style={{
          padding: "16px 12px 0",
          borderTop: `1px solid ${HAIRLINE}`,
        }}
      >
        <Link
          href="/docs"
          style={{
            display: "block",
            padding: "8px 10px",
            fontSize: "13px",
            color: MUTED,
            textDecoration: "none",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          API docs
        </Link>
      </div>
    </aside>
  );
}

function SidebarWithSearch() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("siteId") ?? "";
  return <SidebarInner siteId={siteId} />;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: CREAM,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      {/* Sidebar — suspense boundary for useSearchParams */}
      <Suspense
        fallback={
          <aside
            style={{
              width: "220px",
              minWidth: "220px",
              borderRight: `1px solid ${HAIRLINE}`,
              backgroundColor: CREAM,
            }}
          />
        }
      >
        <SidebarWithSearch />
      </Suspense>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
        {children}
      </main>
    </div>
  );
}

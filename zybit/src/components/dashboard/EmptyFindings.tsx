"use client";

/**
 * Gap 6 — Empty Findings State
 *
 * Context-aware empty state for the findings backlog. Shows different
 * messaging depending on whether the issue is:
 *   - no integration connected
 *   - integration connected but no events received yet
 *   - events flowing but session gate not met
 */

import Link from "next/link";

const INK = "#111111";
const MUTED = "#6B6B6B";
const HAIRLINE = "rgba(0,0,0,0.08)";
const SUBTLE = "rgba(0,0,0,0.04)";
const CREAM = "#FAFAF8";

interface EmptyFindingsProps {
  reason: "no-integration" | "no-events" | "gate-not-met";
  sessionsObserved?: number;
  threshold?: number;
}

export default function EmptyFindings({
  reason,
  sessionsObserved,
  threshold,
}: EmptyFindingsProps) {
  const percent =
    reason === "gate-not-met" && threshold && threshold > 0
      ? Math.min(100, Math.round(((sessionsObserved ?? 0) / threshold) * 100))
      : 0;

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 14,
        padding: "48px 28px",
        textAlign: "center",
      }}
    >
      {reason === "no-integration" && (
        <>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 16,
              fontWeight: 600,
              color: INK,
            }}
          >
            Connect your analytics to start.
          </p>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 14,
              color: MUTED,
              lineHeight: 1.5,
              maxWidth: 400,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Zybit needs a data source to analyze your funnel and surface
            findings. Connect PostHog or Segment to begin.
          </p>
          <Link
            href="/dashboard/connect"
            style={{
              display: "inline-block",
              padding: "10px 22px",
              borderRadius: 999,
              background: INK,
              color: CREAM,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Connect PostHog →
          </Link>
        </>
      )}

      {reason === "no-events" && (
        <>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 16,
              fontWeight: 600,
              color: INK,
            }}
          >
            Your integration is connected.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: MUTED,
              lineHeight: 1.5,
              maxWidth: 400,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Events usually arrive within a few minutes. This page will update
            automatically once data starts flowing.
          </p>
        </>
      )}

      {reason === "gate-not-met" && (
        <>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 16,
              fontWeight: 600,
              color: INK,
            }}
          >
            Zybit needs{" "}
            {threshold && sessionsObserved !== undefined
              ? `${(threshold - sessionsObserved).toLocaleString()} more`
              : "more"}{" "}
            sessions.
          </p>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 14,
              color: MUTED,
              lineHeight: 1.5,
              maxWidth: 400,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {sessionsObserved?.toLocaleString() ?? 0} /{" "}
            {threshold?.toLocaleString() ?? "—"} observed so far. Findings
            will be generated once the session threshold is met.
          </p>

          {/* Progress bar */}
          <div
            style={{
              maxWidth: 320,
              margin: "0 auto",
            }}
          >
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: SUBTLE,
                overflow: "hidden",
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: INK,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: INK,
              }}
            >
              {percent}%
            </p>
          </div>
        </>
      )}
    </div>
  );
}

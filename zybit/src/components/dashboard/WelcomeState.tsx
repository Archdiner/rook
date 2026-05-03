"use client";

/**
 * Gap 6 — Welcome State
 *
 * Shown on the cockpit when a site is connected but hasn't met the
 * session threshold for first insight generation. Provides a progress
 * bar and "while you wait" action cards.
 */

import Link from "next/link";

const INK = "#111111";
const MUTED = "#6B6B6B";
const HAIRLINE = "rgba(0,0,0,0.08)";
const SUBTLE = "rgba(0,0,0,0.04)";

interface WelcomeStateProps {
  domain: string;
  sessionsObserved: number;
  threshold: number;
  siteId: string;
}

function ActionCard({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{
          background: "#fff",
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 12,
          padding: "18px 20px",
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
      >
        <p
          style={{
            margin: "0 0 4px",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: INK,
          }}
        >
          {title}
        </p>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 13,
            color: MUTED,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: INK,
          }}
        >
          {label} →
        </span>
      </div>
    </Link>
  );
}

export default function WelcomeState({
  domain,
  sessionsObserved,
  threshold,
  siteId,
}: WelcomeStateProps) {
  const percent = threshold > 0 ? Math.min(100, Math.round((sessionsObserved / threshold) * 100)) : 0;

  return (
    <div>
      {/* Progress section */}
      <div
        style={{
          background: "#fff",
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 14,
          padding: "28px 28px 24px",
          marginBottom: 24,
        }}
      >
        <p
          style={{
            margin: "0 0 6px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          Baseline Learning
        </p>
        <h2
          style={{
            margin: "0 0 4px",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: INK,
          }}
        >
          Zybit is analyzing {domain}
        </h2>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 14,
            color: MUTED,
            lineHeight: 1.5,
          }}
        >
          {sessionsObserved.toLocaleString()} / {threshold.toLocaleString()}{" "}
          sessions observed. Once the threshold is met, Zybit will generate
          your first ranked findings.
        </p>

        {/* Progress bar */}
        <div
          style={{
            position: "relative",
            height: 10,
            borderRadius: 999,
            background: SUBTLE,
            overflow: "hidden",
            marginBottom: 8,
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 13, color: MUTED }}>
            {sessionsObserved.toLocaleString()} sessions
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: INK,
              letterSpacing: "-0.02em",
            }}
          >
            {percent}%
          </span>
        </div>
      </div>

      {/* While you wait */}
      <div>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          While you wait
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <ActionCard
            title="Set revenue context"
            description="Adding your MRR unlocks dollar-impact framing on every finding, so you can prioritize by business value."
            href={`/dashboard/connect?siteId=${siteId}`}
            label="Add revenue data"
          />
          <ActionCard
            title="Invite your team"
            description="Bring in stakeholders so they can review findings, approve experiments, and track impact together."
            href="/dashboard/settings"
            label="Manage team"
          />
          <ActionCard
            title="Add another site"
            description="Connect additional domains to analyze multiple properties from a single workspace."
            href="/dashboard/connect"
            label="Connect a site"
          />
        </div>
      </div>
    </div>
  );
}

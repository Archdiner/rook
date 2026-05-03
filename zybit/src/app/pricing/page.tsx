/**
 * Public pricing page — plan comparison table.
 */

import Link from "next/link";

const INK = "#111111";
const MUTED = "#6B6B6B";
const HAIRLINE = "rgba(0,0,0,0.08)";
const CREAM = "#FAFAF8";

type Plan = {
  id: string;
  name: string;
  price: string;
  priceNote: string;
  sites: string;
  events: string;
  experiments: string;
  support: string;
  cta: string;
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$199",
    priceNote: "/mo",
    sites: "1",
    events: "100K",
    experiments: "2",
    support: "Email",
    cta: "Get started",
  },
  {
    id: "growth",
    name: "Growth",
    price: "$599",
    priceNote: "/mo",
    sites: "3",
    events: "500K",
    experiments: "10",
    support: "Slack",
    cta: "Get started",
    highlighted: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "$1,499",
    priceNote: "/mo",
    sites: "10",
    events: "2M",
    experiments: "Unlimited",
    support: "Dedicated",
    cta: "Get started",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    priceNote: "",
    sites: "Unlimited",
    events: "Unlimited",
    experiments: "Unlimited",
    support: "SLA",
    cta: "Contact sales",
  },
];

const ROWS = [
  { label: "Monthly price", key: "priceDisplay" as const },
  { label: "Sites", key: "sites" as const },
  { label: "Events / mo", key: "events" as const },
  { label: "Concurrent experiments", key: "experiments" as const },
  { label: "Support", key: "support" as const },
];

export default function PricingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: CREAM,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        color: INK,
      }}
    >
      {/* Header */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "80px 24px 48px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          Pricing
        </p>
        <h1
          style={{
            margin: "0 0 16px",
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
          }}
        >
          Plans that scale with you
        </h1>
        <p
          style={{
            margin: "0 auto",
            maxWidth: 520,
            fontSize: 16,
            lineHeight: 1.6,
            color: MUTED,
          }}
        >
          Every plan includes the full Zybit audit engine, experiment tracking,
          and prescription briefs. Pick the tier that fits your traffic.
        </p>
      </div>

      {/* Comparison table */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 24px 80px",
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 700,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "16px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: MUTED,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  borderBottom: `1px solid ${HAIRLINE}`,
                  width: "20%",
                }}
              />
              {PLANS.map((plan) => (
                <th
                  key={plan.id}
                  style={{
                    textAlign: "center",
                    padding: "16px 12px",
                    borderBottom: `1px solid ${HAIRLINE}`,
                    width: "20%",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: plan.highlighted ? INK : MUTED,
                      }}
                    >
                      {plan.name}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 32,
                        fontWeight: 700,
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {plan.price}
                      {plan.priceNote && (
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 400,
                            color: MUTED,
                          }}
                        >
                          {plan.priceNote}
                        </span>
                      )}
                    </p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <td
                  style={{
                    padding: "14px 12px",
                    fontSize: 14,
                    fontWeight: 500,
                    color: MUTED,
                    borderBottom: `1px solid ${HAIRLINE}`,
                  }}
                >
                  {row.label}
                </td>
                {PLANS.map((plan) => {
                  let value: string;
                  if (row.key === "priceDisplay") {
                    value = `${plan.price}${plan.priceNote}`;
                  } else {
                    value = plan[row.key];
                  }
                  return (
                    <td
                      key={plan.id}
                      style={{
                        padding: "14px 12px",
                        textAlign: "center",
                        fontSize: 14,
                        fontWeight: 600,
                        borderBottom: `1px solid ${HAIRLINE}`,
                        backgroundColor: plan.highlighted
                          ? "rgba(0,0,0,0.02)"
                          : "transparent",
                      }}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* CTA row */}
            <tr>
              <td style={{ padding: "20px 12px" }} />
              {PLANS.map((plan) => (
                <td
                  key={plan.id}
                  style={{ padding: "20px 12px", textAlign: "center" }}
                >
                  {plan.id === "enterprise" ? (
                    <Link
                      href="mailto:sales@zybit.dev"
                      style={{
                        display: "inline-block",
                        padding: "10px 24px",
                        borderRadius: 999,
                        border: `1px solid ${HAIRLINE}`,
                        background: "transparent",
                        color: INK,
                        fontSize: 14,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      {plan.cta}
                    </Link>
                  ) : (
                    <Link
                      href={`/sign-up?plan=${plan.id}`}
                      style={{
                        display: "inline-block",
                        padding: "10px 24px",
                        borderRadius: 999,
                        border: "none",
                        background: plan.highlighted ? INK : "rgba(0,0,0,0.06)",
                        color: plan.highlighted ? CREAM : INK,
                        fontSize: 14,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      {plan.cta}
                    </Link>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

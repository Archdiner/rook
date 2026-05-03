import Link from "next/link";
import { Logo } from "@/components/logo";

type Plan = {
  id: string;
  name: string;
  price: string;
  priceNote: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$199",
    priceNote: "/mo",
    description: "For small teams starting their testing journey.",
    features: [
      "1 site",
      "100K events/mo",
      "2 concurrent experiments",
      "Email support",
    ],
    cta: "Get started",
  },
  {
    id: "growth",
    name: "Growth",
    price: "$599",
    priceNote: "/mo",
    description: "For scaling products with significant traffic.",
    features: [
      "3 sites",
      "500K events/mo",
      "10 concurrent experiments",
      "Slack connect channel",
    ],
    cta: "Get started",
    highlighted: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "$1,499",
    priceNote: "/mo",
    description: "For mature platforms needing high throughput.",
    features: [
      "10 sites",
      "2M events/mo",
      "Unlimited experiments",
      "Dedicated account manager",
    ],
    cta: "Get started",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    priceNote: "",
    description: "For massive traffic and custom security needs.",
    features: [
      "Unlimited sites",
      "Unlimited events",
      "Unlimited experiments",
      "Custom SLA & SOC2",
    ],
    cta: "Contact sales",
  },
];

function AuthNavCta() {
  return (
    <Link
      href="/dashboard"
      className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#111] transition-colors hover:text-[#555]"
    >
      Dashboard →
    </Link>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen w-full bg-[#FAFAF8] text-[#111] sans-text selection:bg-[#111] selection:text-[#FAFAF8]">
      {/* Header (matches landing page) */}
      <header className="fixed top-0 left-0 w-full px-6 py-6 flex flex-wrap items-center justify-between gap-y-4 z-50 pointer-events-auto backdrop-blur-md bg-[rgba(250,250,248,0.85)] border-b border-black/[0.04]">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <Logo className="w-6 h-6 text-[#111]" />
          <span className="text-xl font-bold tracking-tight text-[#111] sans-text">Zybit</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-4 md:gap-8 sans-text">
          <AuthNavCta />
        </nav>
      </header>

      <div className="pt-[15vh] px-6 md:px-12 max-w-[1400px] mx-auto pb-32">
        {/* Title Section */}
        <div className="max-w-[800px] mb-20 md:mb-32">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B6B6B] mb-6">
            Pricing
          </p>
          <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-[7rem] font-bold tracking-tighter leading-[0.9] mb-8">
            Scale with<br />
            signal.
          </h1>
          <p className="text-lg md:text-2xl text-[#6B6B6B] leading-snug max-w-[600px]">
            Every tier includes the full Zybit audit engine. Pick the capacity that fits your traffic.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-[2rem] p-8 transition-transform duration-300 hover:-translate-y-2 ${
                plan.highlighted
                  ? "bg-[#111] text-[#FAFAF8] shadow-2xl scale-100 lg:scale-105 z-10"
                  : "bg-white border border-black/[0.06] shadow-sm hover:shadow-xl"
              }`}
            >
              <div className="mb-12">
                <p className={`text-[11px] font-bold tracking-[0.15em] uppercase mb-6 ${plan.highlighted ? "text-[#A0A0A0]" : "text-[#6B6B6B]"}`}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl lg:text-5xl font-bold tracking-tighter">
                    {plan.price}
                  </span>
                  {plan.priceNote && (
                    <span className={`text-sm font-medium ${plan.highlighted ? "text-[#A0A0A0]" : "text-[#6B6B6B]"}`}>
                      {plan.priceNote}
                    </span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed ${plan.highlighted ? "text-[#E0E0E0]" : "text-[#6B6B6B]"}`}>
                  {plan.description}
                </p>
              </div>

              <div className="flex-grow">
                <ul className="space-y-4 mb-12">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-medium">
                      <svg
                        className={`w-5 h-5 shrink-0 mt-0.5 ${plan.highlighted ? "text-[#FAFAF8]" : "text-[#111]"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={plan.highlighted ? "text-[#FAFAF8]" : "text-[#111]"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {plan.id === "enterprise" ? (
                <Link
                  href="mailto:sales@zybit.dev"
                  className="w-full text-center py-4 rounded-full text-sm font-bold border border-black/[0.08] hover:bg-black/[0.02] transition-colors"
                >
                  {plan.cta}
                </Link>
              ) : (
                <Link
                  href={`/sign-up?plan=${plan.id}`}
                  className={`w-full text-center py-4 rounded-full text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95 ${
                    plan.highlighted
                      ? "bg-[#FAFAF8] text-[#111]"
                      : "bg-[#111] text-[#FAFAF8]"
                  }`}
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

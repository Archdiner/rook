"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Phase1SiteRecord } from "@/lib/phase1";
import {
  createSiteAction,
  createIntegrationAction,
  saveSiteMetaAction,
} from "@/app/app/onboarding/actions";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4;

interface WizardState {
  step: Step;
  siteId: string | null;
  siteDomain: string | null;
  proxySlug: string | null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {([1, 2, 3, 4] as Step[]).map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
              s < step
                ? "bg-[#111] text-[#FAFAF8]"
                : s === step
                ? "bg-[#111] text-[#FAFAF8] ring-2 ring-[#111] ring-offset-2"
                : "bg-black/[0.08] text-[#6B6B6B]"
            }`}
          >
            {s < step ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              s
            )}
          </div>
          {s < 4 && <div className={`w-8 h-px ${s < step ? "bg-[#111]" : "bg-black/[0.1]"}`} />}
        </div>
      ))}
    </div>
  );
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] mb-2">
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 bg-[#111] text-[#FAFAF8] px-6 py-3 font-bold text-sm uppercase tracking-[0.08em] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading && (
        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

function SkipLink({ onClick, label = "Skip for now" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-[#6B6B6B] hover:text-[#111] transition-colors underline underline-offset-2"
    >
      {label}
    </button>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B] mb-1.5">
      {label}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full border border-black/[0.12] rounded-lg px-3 py-2.5 text-sm text-[#111] placeholder:text-[#9B9B9B] focus:outline-none focus:ring-2 focus:ring-[#111]/20 focus:border-[#111]/30 transition-all"
    />
  );
}

// ---------------------------------------------------------------------------
// Step 1: Site URL
// ---------------------------------------------------------------------------

function Step1({
  initialDomain,
  onComplete,
}: {
  initialDomain?: string;
  onComplete: (siteId: string, domain: string, proxySlug: string | null) => void;
}) {
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const result = await createSiteAction(domain, name);
      if (!result.ok) {
        setError(result.error);
      } else {
        onComplete(result.site.id, result.site.domain, result.site.proxySlug ?? null);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <StepLabel>Step 1 of 4</StepLabel>
      <h1 className="text-4xl font-bold tracking-tighter text-[#111] mb-2 leading-[0.95]">
        What are we<br />analyzing?
      </h1>
      <p className="text-[#6B6B6B] text-sm mb-8 leading-relaxed max-w-sm">
        Enter your product URL. Zybit will use this to scope all analysis, screenshots, and findings.
      </p>

      <div className="space-y-4 max-w-sm">
        <div>
          <FieldLabel label="Site URL" />
          <Input
            value={domain}
            onChange={setDomain}
            placeholder="yoursite.com"
            autoFocus
          />
        </div>
        <div>
          <FieldLabel label="Site name (optional)" />
          <Input
            value={name}
            onChange={setName}
            placeholder="Acme Corp"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <PrimaryButton
          onClick={handleSubmit}
          loading={loading}
          disabled={!domain.trim()}
        >
          Continue
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Proxy DNS setup
// ---------------------------------------------------------------------------

function CopyButton({ text, inline = false }: { text: string; inline?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (inline) {
    return (
      <button
        type="button"
        onClick={copy}
        className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B6B6B] hover:text-[#111] transition-colors px-2 py-1 rounded border border-black/[0.08] bg-white shrink-0"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="absolute top-3 right-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B6B6B] hover:text-[#111] transition-colors px-2 py-1 rounded bg-white border border-black/[0.08]"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function Step2({
  proxySlug,
  domain,
  onComplete,
  onSkip,
}: {
  proxySlug: string | null;
  domain: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const proxyHost = proxySlug ? `${proxySlug}.zybit.run` : null;

  return (
    <div>
      <StepLabel>Step 2 of 4</StepLabel>
      <h1 className="text-4xl font-bold tracking-tighter text-[#111] mb-2 leading-[0.95]">
        Set up your<br />proxy domain.
      </h1>
      <p className="text-[#6B6B6B] text-sm mb-8 leading-relaxed max-w-sm">
        Zybit deploys variants by proxying traffic to <strong>{domain}</strong>.
        Add one CNAME record to your DNS — 30 seconds.
      </p>

      {proxyHost ? (
        <div className="max-w-lg mb-6 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B] mb-2">
              Your Zybit proxy address
            </p>
            <div className="flex items-center gap-2 bg-[#F5F5F3] border border-black/[0.08] rounded-xl px-4 py-3 font-mono text-sm text-[#333]">
              <span className="flex-1">{proxyHost}</span>
              <CopyButton text={proxyHost} inline />
            </div>
          </div>

          <div className="bg-[#F5F5F3] border border-black/[0.08] rounded-xl p-4 text-sm space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B] mb-3">
              Add this record in your DNS provider
            </p>
            <div className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-1.5 font-mono text-xs text-[#333]">
              <span className="text-[#6B6B6B] font-sans font-semibold">Type</span>
              <span>CNAME</span>
              <span className="text-[#6B6B6B] font-sans font-semibold">Name</span>
              <span>ab <span className="text-[#9B9B9B] font-sans">(or any subdomain you choose)</span></span>
              <span className="text-[#6B6B6B] font-sans font-semibold">Value</span>
              <span>{proxyHost}</span>
            </div>
          </div>

          <p className="text-xs text-[#9B9B9B] leading-relaxed">
            Your test URL will be something like <span className="font-mono">ab.{domain}</span>.
            Zybit sits transparently between your visitors and your origin.
          </p>
        </div>
      ) : (
        <div className="max-w-lg mb-6 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
          Proxy address unavailable — contact support.
        </div>
      )}

      <div className="flex items-center gap-4">
        <PrimaryButton onClick={onComplete}>
          Continue
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </PrimaryButton>
        <SkipLink onClick={onSkip} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Connect analytics
// ---------------------------------------------------------------------------

type AnalyticsProvider = "posthog" | "segment";

function Step3({
  siteId,
  onComplete,
  onSkip,
}: {
  siteId: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [provider, setProvider] = useState<AnalyticsProvider>("posthog");
  const [host, setHost] = useState("https://app.posthog.com");
  const [projectId, setProjectId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const segmentWebhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/phase2/integrations/segment-webhook-placeholder`
    : "";

  async function handleConnect() {
    setError("");
    setLoading(true);
    try {
      const result = await createIntegrationAction({
        siteId,
        provider,
        host: provider === "posthog" ? host : undefined,
        projectId: provider === "posthog" ? projectId : undefined,
        apiKey,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        onComplete();
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = provider === "posthog"
    ? host.trim() && projectId.trim() && apiKey.trim()
    : apiKey.trim();

  return (
    <div>
      <StepLabel>Step 3 of 4</StepLabel>
      <h1 className="text-4xl font-bold tracking-tighter text-[#111] mb-2 leading-[0.95]">
        Connect your<br />analytics.
      </h1>
      <p className="text-[#6B6B6B] text-sm mb-8 leading-relaxed max-w-sm">
        Zybit pulls behavioral data from your analytics provider to generate findings.
      </p>

      {/* Provider tabs */}
      <div className="flex gap-1 mb-6 bg-black/[0.04] rounded-lg p-1 w-fit">
        {(["posthog", "segment"] as AnalyticsProvider[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setProvider(p); setError(""); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              provider === p
                ? "bg-white text-[#111] shadow-sm border border-black/[0.06]"
                : "text-[#6B6B6B] hover:text-[#111]"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="space-y-4 max-w-sm">
        {provider === "posthog" ? (
          <>
            <div>
              <FieldLabel label="PostHog host URL" />
              <Input value={host} onChange={setHost} placeholder="https://app.posthog.com" />
            </div>
            <div>
              <FieldLabel label="Project ID" />
              <Input value={projectId} onChange={setProjectId} placeholder="12345" />
            </div>
            <div>
              <FieldLabel label="Personal API key" />
              <Input value={apiKey} onChange={setApiKey} placeholder="phx_..." type="password" />
              <p className="text-xs text-[#9B9B9B] mt-1">
                Settings → Personal API keys → Create new key (read access required)
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <FieldLabel label="Your Zybit webhook URL" />
              <div className="relative">
                <Input value={segmentWebhookUrl} onChange={() => {}} />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(segmentWebhookUrl)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B6B6B] hover:text-[#111] transition-colors"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-[#9B9B9B] mt-1">
                Add this as a webhook destination in Segment
              </p>
            </div>
            <div>
              <FieldLabel label="Webhook bearer token" />
              <Input
                value={apiKey}
                onChange={setApiKey}
                placeholder="Choose a shared secret"
                type="password"
              />
              <p className="text-xs text-[#9B9B9B] mt-1">
                Set the same value in Segment under Authorization header
              </p>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-4 pt-1">
          <PrimaryButton onClick={handleConnect} loading={loading} disabled={!canSubmit}>
            Connect
          </PrimaryButton>
          <SkipLink onClick={onSkip} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Revenue framing
// ---------------------------------------------------------------------------

function Step4({
  siteId,
  onComplete,
}: {
  siteId: string;
  onComplete: () => void;
}) {
  const [mrr, setMrr] = useState("");
  const [aov, setAov] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleFinish(skip: boolean) {
    setLoading(true);
    try {
      if (!skip && (mrr || aov)) {
        const mrrCents = mrr ? Math.round(parseFloat(mrr) * 100) : null;
        const aovCents = aov ? Math.round(parseFloat(aov) * 100) : null;
        await saveSiteMetaAction(siteId, mrrCents, aovCents);
      }
      onComplete();
      router.push("/app");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <StepLabel>Step 4 of 4</StepLabel>
      <h1 className="text-4xl font-bold tracking-tighter text-[#111] mb-2 leading-[0.95]">
        Unlock dollar&#8209;impact<br />findings.
      </h1>
      <p className="text-[#6B6B6B] text-sm mb-2 leading-relaxed max-w-sm">
        When Zybit knows your revenue, every finding gets an estimated impact in dollars — not just severity labels.
      </p>
      <p className="text-xs text-[#9B9B9B] mb-8 max-w-sm">
        These are estimates only. Used for prioritization framing, never shared.
      </p>

      <div className="space-y-4 max-w-sm">
        <div>
          <FieldLabel label="Monthly revenue (MRR or GMV)" />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6B6B]">$</span>
            <input
              type="number"
              value={mrr}
              onChange={(e) => setMrr(e.target.value)}
              placeholder="50,000"
              min="0"
              className="w-full border border-black/[0.12] rounded-lg pl-7 pr-3 py-2.5 text-sm text-[#111] placeholder:text-[#9B9B9B] focus:outline-none focus:ring-2 focus:ring-[#111]/20 focus:border-[#111]/30 transition-all"
            />
          </div>
        </div>
        <div>
          <FieldLabel label="Average order / conversion value" />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6B6B]">$</span>
            <input
              type="number"
              value={aov}
              onChange={(e) => setAov(e.target.value)}
              placeholder="120"
              min="0"
              className="w-full border border-black/[0.12] rounded-lg pl-7 pr-3 py-2.5 text-sm text-[#111] placeholder:text-[#9B9B9B] focus:outline-none focus:ring-2 focus:ring-[#111]/20 focus:border-[#111]/30 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <PrimaryButton
            onClick={() => handleFinish(false)}
            loading={loading}
          >
            Finish setup
          </PrimaryButton>
          <SkipLink onClick={() => handleFinish(true)} label="I don't know these yet" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard shell
// ---------------------------------------------------------------------------

export default function OnboardingWizard({
  existingSite,
  hasIntegration,
}: {
  existingSite: Phase1SiteRecord | null;
  hasIntegration: boolean;
}) {
  const startStep: Step = existingSite
    ? hasIntegration
      ? 4
      : 2
    : 1;

  const [state, setState] = useState<WizardState>({
    step: startStep,
    siteId: existingSite?.id ?? null,
    siteDomain: existingSite?.domain ?? null,
    proxySlug: existingSite?.proxySlug ?? null,
  });

  function advance(to: Step, patch?: Partial<WizardState>) {
    setState((prev) => ({ ...prev, step: to, ...patch }));
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-20 px-6">
      <div className="w-full max-w-xl">
        <ProgressBar step={state.step} />

        {state.step === 1 && (
          <Step1
            initialDomain={state.siteDomain ?? ""}
            onComplete={(siteId, domain, proxySlug) =>
              advance(2, { siteId, siteDomain: domain, proxySlug })
            }
          />
        )}

        {state.step === 2 && state.siteDomain && (
          <Step2
            proxySlug={state.proxySlug}
            domain={state.siteDomain}
            onComplete={() => advance(3)}
            onSkip={() => advance(3)}
          />
        )}

        {state.step === 3 && state.siteId && (
          <Step3
            siteId={state.siteId}
            onComplete={() => advance(4)}
            onSkip={() => advance(4)}
          />
        )}

        {state.step === 4 && state.siteId && (
          <Step4
            siteId={state.siteId}
            onComplete={() => {}}
          />
        )}
      </div>
    </div>
  );
}

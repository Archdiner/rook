"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { checkInstallAction } from "@/app/app/onboarding/actions";

type VerifyState = "idle" | "polling" | "success" | "timeout";

interface InstallVerifierProps {
  siteId: string;
  /** If true, starts the verifier already expanded (wizard use-case). */
  autoStart?: boolean;
  onDetected?: () => void;
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

export default function InstallVerifier({ siteId, autoStart, onDetected }: InstallVerifierProps) {
  const [state, setState] = useState<VerifyState>(autoStart ? "polling" : "idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    attemptsRef.current = 0;
    setState("polling");

    pollRef.current = setInterval(async () => {
      attemptsRef.current += 1;
      const detected = await checkInstallAction(siteId);
      if (detected) {
        stopPolling();
        setState("success");
        onDetected?.();
        return;
      }
      if (attemptsRef.current >= 20) {
        stopPolling();
        setState("timeout");
      }
    }, 3000);
  }, [siteId, stopPolling, onDetected]);

  useEffect(() => {
    if (autoStart) startPolling();
    return stopPolling;
  }, [autoStart, startPolling, stopPolling]);

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={startPolling}
        className="inline-flex items-center gap-2 bg-[#111] text-[#FAFAF8] px-4 py-2.5 font-bold text-sm uppercase tracking-[0.08em] hover:opacity-80 transition-opacity"
      >
        Verify installation
      </button>
    );
  }

  if (state === "polling") {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-[#6B6B6B]">
        <Spinner />
        Listening for events&hellip;
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Script detected — receiving events
      </div>
    );
  }

  // timeout
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={startPolling}
        className="inline-flex items-center gap-2 bg-[#111] text-[#FAFAF8] px-4 py-2.5 font-bold text-sm uppercase tracking-[0.08em] hover:opacity-80 transition-opacity"
      >
        Check again (60s)
      </button>
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 max-w-sm">
        <p className="text-sm text-amber-800 leading-relaxed">
          Still not seeing events — your deploy might still be rolling out.
          The script is correct; check that it&rsquo;s in{" "}
          <code className="text-xs font-mono bg-amber-100 px-1 rounded">&lt;head&gt;</code>{" "}
          and your site has had real visitor traffic.
        </p>
      </div>
    </div>
  );
}

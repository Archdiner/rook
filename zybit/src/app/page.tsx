"use client";

import React, { useState } from "react";
import { ParticleCanvas } from "@/components/particle-background";

import { IntakeModal } from "@/components/IntakeModal";
import { SiteNav } from "@/components/SiteNav";

// ---------------------------------------------------------------------------
// Main Application
// ---------------------------------------------------------------------------

function MinimalDOM({ openModal }: { openModal: () => void }) {
  return (
    <div className="w-full text-[#111]">
      {/* Hero: Data Core is compact, text can sit close below */}
      <section className="h-screen w-full flex flex-col justify-end md:justify-center px-6 md:px-24 pb-10 md:pb-0 pointer-events-none">
        <div className="w-full max-w-[700px]">
          <div className="sans-text text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] mb-4 md:mb-6">
            For product managers
          </div>
          <h1 className="sans-text text-[2.5rem] sm:text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter mb-4 md:mb-8 leading-[0.9]">
            Clarity over<br />
            intuition.
          </h1>
          <div className="sans-text text-sm sm:text-xl md:text-2xl font-medium text-[#6B6B6B] leading-relaxed md:leading-snug space-y-3 md:space-y-4">
            <p className="text-[#111]">
              Zybit analyzes how people actually use your product (clicks, paths, sessions) and ranks what to change first.
            </p>
            <p>
              The output is a prioritized fix list tied to real stalls and drop-offs, not opinion decks or generic redesign checklists.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: DNA — on mobile text starts below the helix */}
      <section className="h-screen w-full flex flex-col pt-[65vh] md:pt-0 md:justify-start md:items-start px-6 md:px-24 pointer-events-none">
        <div className="w-full md:max-w-[500px] md:mt-[20vh]">
          <h2 className="sans-text text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-3 md:mb-6">Pain shows up in behavior.</h2>
          <div className="sans-text text-sm sm:text-xl md:text-2xl text-[#6B6B6B] leading-relaxed md:leading-snug space-y-3 md:space-y-4">
            <p>If the journey is broken, your analytics already show it: missed clicks, weak conversion, repetitive loops.</p>
            <p className="text-[#111]">We ground recommendations in that behavior so you solve real friction, not placeholder roadmap items.</p>
          </div>
        </div>
      </section>

      {/* Section 3: Jet — text sits below the jet silhouette */}
      <section className="h-screen w-full flex flex-col pt-[55vh] md:pt-0 md:justify-start md:items-end px-6 md:px-24 md:text-right pointer-events-none">
        <div className="w-full md:max-w-[500px] md:mt-[20vh]">
          <h2 className="sans-text text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-3 md:mb-6">Fix what hurts users first.</h2>
          <div className="sans-text text-sm sm:text-xl md:text-2xl text-[#6B6B6B] leading-relaxed md:leading-snug space-y-3 md:space-y-4">
            <p>Priorities mirror the friction visible in your data.</p>
            <p className="text-[#111]">You ship changes you can justify with evidence, not scattershot UX tweaks.</p>
          </div>
        </div>
      </section>

      {/* Section 4: Microchip — text near top, chip rendered below */}
      <section className="h-screen w-full flex flex-col pt-[12vh] md:pt-0 md:justify-start md:items-start px-6 md:px-24 pointer-events-none">
        <div className="w-full md:max-w-[500px] md:mt-[15vh]">
          <h2 className="sans-text text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-3 md:mb-6">What Zybit means.</h2>
          <div className="sans-text text-sm sm:text-xl md:text-2xl text-[#6B6B6B] leading-relaxed md:leading-snug space-y-3 md:space-y-4">
            <p>
              <span className="text-[#111]">Behavior-first:</span> product usage in; ranked, explainable priorities out.
            </p>
            <p className="text-[#111]">Signal from your data, not gut feel, decides what ships.</p>
          </div>
        </div>
      </section>

      {/* Section 5: Sample Finding — screenshot + receipt card */}
      <section className="min-h-screen w-full flex items-center justify-center px-6 py-24 pointer-events-none">
        <div className="w-full max-w-5xl">
          <div className="sans-text text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] mb-8 md:mb-10 text-center">
            Sample finding
          </div>

          {/* Two-column on desktop, stacked on mobile */}
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-10">

            {/* Left: product screenshot in browser frame */}
            <div className="w-full lg:flex-1">
              <div
                className="border-2 border-[#111] overflow-hidden"
                style={{ boxShadow: '8px 8px 0px #111' }}
              >
                <div className="bg-[#111] flex items-center gap-1.5 px-4 py-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#3a3a3a]" />
                  <div className="w-2 h-2 rounded-full bg-[#4a4a4a]" />
                  <div className="w-2 h-2 rounded-full bg-[#5a5a5a]" />
                  <div className="ml-3 flex-1 bg-[#1c1c1c] rounded-sm text-[9px] font-mono text-[#555] px-3 py-1 truncate">
                    app.getzybit.com · rage-click-target analysis
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/screenshot-analysis.png"
                  alt="Zybit flagging a rage-click friction point in the product"
                  className="w-full block"
                  width={720}
                  height={450}
                />
              </div>
              <p className="sans-text text-[10px] text-[#6B6B6B] mt-2.5 leading-relaxed">
                Zybit maps rage-click density to the exact element during analysis — before the receipt is issued.
              </p>
            </div>

            {/* Right: receipt card */}
            <div className="w-full lg:w-[360px] flex-shrink-0">
              <div
                className="sans-text bg-[#FAFAF8] border-2 border-[#111]"
                style={{ boxShadow: '8px 8px 0px #111' }}
              >
                <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[#111] text-[10px] font-bold uppercase tracking-[0.18em] text-[#111] gap-3">
                  <span className="truncate">F-0042 · rage-click-target</span>
                  <span className="whitespace-nowrap text-[#6B6B6B] flex-shrink-0">High · 0.84</span>
                </div>
                <div className="px-5 py-5 border-b border-[#111]/15">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6B6B] mb-2">
                    Finding
                  </div>
                  <div className="text-base md:text-lg font-bold leading-snug tracking-tight text-[#111]">
                    Rage-clicks on checkout promo-code field
                  </div>
                </div>
                <div className="px-5 py-4 border-b border-[#111]/15">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6B6B] mb-2">
                    Evidence · PostHog · 7d
                  </div>
                  <div className="text-sm text-[#111] leading-relaxed">
                    847 rage-click events on{' '}
                    <span className="font-mono text-[0.9em] bg-black/[0.06] px-1 rounded-sm">#promo-code</span>{' '}
                    over 7 days. Checkout completion 2.1% with field vs 3.4% without.
                  </div>
                </div>
                <div className="px-5 py-4 border-b border-[#111]/15">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6B6B] mb-2">
                    Change
                  </div>
                  <div className="text-sm text-[#111] leading-relaxed">
                    Collapse promo-code behind a &ldquo;Have a code?&rdquo; toggle below the primary CTA.
                  </div>
                </div>
                <div className="px-5 py-3.5 flex items-center justify-between bg-[#111] text-[#FAFAF8]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-60">
                    Est. impact
                  </div>
                  <div className="text-sm font-bold tracking-tight">
                    ~$3.2k / month
                  </div>
                </div>
              </div>
              <p className="sans-text text-[10px] text-[#6B6B6B] mt-2.5 leading-relaxed">
                Every finding ships with traceable evidence. No invented numbers.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Section 6: CTA */}
      <section className="h-screen w-full flex flex-col items-center justify-center text-center px-6">
        <h2 className="sans-text text-3xl sm:text-5xl md:text-8xl font-bold tracking-tighter mb-4 md:mb-6 pointer-events-none">
          See if Zybit fits.
        </h2>
        <div className="sans-text pointer-events-none mb-8 max-w-md mx-auto space-y-2 text-sm text-[#6B6B6B] md:mb-12 md:text-lg">
          <p>Send your site—we&rsquo;ll review your funnel manually.</p>
          <p>We&rsquo;ll only reach out if there&rsquo;s a real match.</p>
        </div>
        <button
          onClick={openModal}
          className="btn-brutalist pointer-events-auto"
        >
          Request Access
        </button>
      </section>

      {/* Footer: human attribution */}
      <footer className="relative z-20 w-full bg-[#FAFAF8] border-t border-black/[0.06] px-6 py-6 text-center pointer-events-none">
        <p className="sans-text text-[10px] md:text-[11px] font-medium uppercase tracking-[0.18em] md:tracking-[0.2em] text-[#6B6B6B]">
          <span className="block md:inline">Built by Jad and Asad at Cornell.</span>
          <span className="hidden md:inline"> </span>
          <span className="block md:inline">We review every submission personally.</span>
        </p>
      </footer>
    </div>
  );
}

// --- Main Application ---

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <main className="relative w-full bg-[#FAFAF8] text-[#111]">
      <SiteNav onRequestAccess={openModal} />

      <ParticleCanvas />

      <div className="relative z-10 w-full">
        <MinimalDOM openModal={openModal} />
      </div>

      <IntakeModal isOpen={isModalOpen} onClose={closeModal} />
    </main>
  );
}

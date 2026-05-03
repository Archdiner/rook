"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ParticleCanvas } from "@/components/particle-background";
import { useAuth } from "@clerk/nextjs";
import { Logo } from "@/components/logo";

import { IntakeModal } from "@/components/IntakeModal";

// ---------------------------------------------------------------------------
// Main Application
// ---------------------------------------------------------------------------

function MinimalDOM({ openModal }: { openModal: () => void }) {
  return (
    <div className="w-full text-[#111]">
      {/* Hero: Data Core is compact, text can sit close below */}
      <section className="h-screen w-full flex flex-col justify-end md:justify-center px-6 md:px-24 pb-10 md:pb-0 pointer-events-none">
        <div className="max-w-[700px]">
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

      {/* Section 2: DNA is 11 units tall — text must start very low */}
      <section className="h-screen w-full flex flex-col pt-[62vh] md:pt-0 md:justify-start md:items-start px-6 md:px-24 pointer-events-none">
        <div className="max-w-[500px] md:mt-[20vh]">
          <h2 className="sans-text text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-3 md:mb-6">Pain shows up in behavior.</h2>
          <div className="sans-text text-sm sm:text-xl md:text-2xl text-[#6B6B6B] leading-relaxed md:leading-snug space-y-3 md:space-y-4">
            <p>If the journey is broken, your analytics already show it: missed clicks, weak conversion, repetitive loops.</p>
            <p className="text-[#111]">We ground recommendations in that behavior so you solve real friction, not placeholder roadmap items.</p>
          </div>
        </div>
      </section>

      {/* Section 3: Jet is wide but not tall — text can be higher */}
      <section className="h-screen w-full flex flex-col pt-[50vh] md:pt-0 md:justify-start md:items-end px-6 md:px-24 md:text-right pointer-events-none">
        <div className="max-w-[500px] md:mt-[20vh]">
          <h2 className="sans-text text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-3 md:mb-6">Fix what hurts users first.</h2>
          <div className="sans-text text-sm sm:text-xl md:text-2xl text-[#6B6B6B] leading-relaxed md:leading-snug space-y-3 md:space-y-4">
            <p>Priorities mirror the friction visible in your data.</p>
            <p className="text-[#111]">You ship changes you can justify with evidence, not scattershot UX tweaks.</p>
          </div>
        </div>
      </section>

      {/* Section 4: Microchip is flat/wide — text can be higher */}
      <section className="h-screen w-full flex flex-col pt-[15vh] md:pt-0 md:justify-start md:items-start px-6 md:px-24 pointer-events-none">
        <div className="max-w-[500px] md:mt-[15vh]">
          <h2 className="sans-text text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-3 md:mb-6">What Zybit means.</h2>
          <div className="sans-text text-sm sm:text-xl md:text-2xl text-[#6B6B6B] leading-relaxed md:leading-snug space-y-3 md:space-y-4">
            <p>
              <span className="text-[#111]">Behavior-first:</span> product usage in; ranked, explainable priorities out.
            </p>
            <p className="text-[#111]">Signal from your data, not gut feel, decides what ships.</p>
          </div>
        </div>
      </section>

      {/* Section 5: CTA */}
      <section className="h-screen w-full flex flex-col items-center justify-center text-center px-6">
        <h2 className="sans-text text-3xl sm:text-5xl md:text-8xl font-bold tracking-tighter mb-4 md:mb-6 pointer-events-none">
          See if Zybit fits.
        </h2>
        <div className="sans-text pointer-events-none mb-8 max-w-md mx-auto space-y-2 text-sm text-[#6B6B6B] md:mb-12 md:text-lg">
          <p>Send your site—we’ll review your funnel manually.</p>
          <p>We’ll only reach out if there’s a real match.</p>
        </div>
        <button
          onClick={openModal}
          className="btn-brutalist pointer-events-auto"
        >
          Request Access
        </button>
      </section>

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
      <header className="fixed top-0 left-0 w-full px-6 py-6 flex flex-wrap items-center justify-between gap-y-4 z-50 pointer-events-auto backdrop-blur-md bg-[rgba(250,250,248,0.85)] border-b border-black/[0.04]">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <Logo className="w-6 h-6 text-[#111]" />
          <span className="text-xl font-bold tracking-tight text-[#111] sans-text">Zybit</span>
        </Link>
        <nav
          className="flex flex-wrap items-center justify-end gap-6 md:gap-8 sans-text"
          aria-label="Primary"
        >
          <Link
            href="/dashboard"
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] transition-colors hover:text-[#111]"
          >
            Interactive Preview
          </Link>
          <button
            onClick={openModal}
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#111] transition-colors hover:text-[#555] bg-transparent border-none cursor-pointer"
          >
            Request Access
          </button>
        </nav>
      </header>

      <ParticleCanvas />

      <div className="relative z-10 w-full">
        <MinimalDOM openModal={openModal} />
      </div>

      <IntakeModal isOpen={isModalOpen} onClose={closeModal} />
    </main>
  );
}

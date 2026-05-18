"use client";

import React, { useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { IntakeModal } from "@/components/IntakeModal";
import { DashboardParticleCanvas } from "@/components/particle-background";
import { MockWebsite } from "@/components/MockWebsite";
import { SiteNav } from "@/components/SiteNav";

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Text opacities based on scroll phases.
  // Anchor keyframes at scroll=0 and scroll=1 are required: framer-motion v12 drives
  // these via WAAPI ScrollTimeline, and past the last defined offset it interpolates
  // linearly toward the property's base value (1 for opacity) instead of clamping.
  const heroOpacity = useTransform(scrollYProgress, [0, 0.1, 1], [1, 0, 0]);
  const phase1Opacity = useTransform(scrollYProgress, [0, 0.1, 0.15, 0.3, 0.35, 1], [0, 0, 1, 1, 0, 0]);
  const phase2Opacity = useTransform(scrollYProgress, [0, 0.35, 0.4, 0.55, 0.6, 1], [0, 0, 1, 1, 0, 0]);
  const phase3Opacity = useTransform(scrollYProgress, [0, 0.6, 0.65, 0.8, 0.85, 1], [0, 0, 1, 1, 0, 0]);
  const phase4Opacity = useTransform(scrollYProgress, [0, 0.85, 0.9, 1], [0, 0, 1, 1]);

  return (
    <div className="bg-[#FAFAF8] font-sans selection:bg-[#111] selection:text-[#FAFAF8] relative">
      <SiteNav onRequestAccess={() => setIsModalOpen(true)} />
      
      {/* 500vh container to allow for a long scroll experience */}
      <div ref={containerRef} className="h-[500vh] w-full relative">
        
        {/* Sticky viewport that stays on screen while scrolling */}
        <div className="sticky top-0 h-[100svh] w-full flex flex-col items-center justify-center overflow-hidden">

          {/* Particles behind everything */}
          <DashboardParticleCanvas scrollYProgress={scrollYProgress} />

          {/* The central literal demonstration */}
          <div className="z-10 w-full px-6 md:px-24 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 max-w-[1400px] mx-auto pointer-events-none">

            {/* Left side text that swaps out (desktop only) */}
            <div className="flex-1 w-full max-w-[500px] relative h-[300px] flex items-center hidden lg:flex">
              
              <motion.div className="absolute w-full" style={{ opacity: heroOpacity }}>
                <div className="sans-text text-[11px] font-bold uppercase tracking-[0.2em] text-[#111] mb-6 border-b border-black/[0.1] pb-2 inline-block">LIVE AUDIT VIEW</div>
                <h1 className="sans-text text-[2.5rem] sm:text-5xl font-bold tracking-tighter mb-4 leading-[0.9] text-[#111]">
                  See the system<br />in action.
                </h1>
                <p className="sans-text text-sm sm:text-lg text-[#6B6B6B] leading-relaxed">
                  Scroll down to watch how Zybit autonomously interfaces with your frontend architecture.
                </p>
              </motion.div>

              <motion.div className="absolute w-full" style={{ opacity: phase1Opacity }}>
                <div className="sans-text font-bold text-[10px] text-[#6B6B6B] mb-2 uppercase tracking-widest">Phase 01</div>
                <h2 className="sans-text text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[#111]">Extract Design DNA.</h2>
                <p className="sans-text text-sm sm:text-lg text-[#6B6B6B] leading-relaxed">
                  We build an exact structural replica of your application by mapping DOM topology and extracting core style tokens.
                </p>
              </motion.div>

              <motion.div className="absolute w-full" style={{ opacity: phase2Opacity }}>
                <div className="sans-text font-bold text-[10px] text-[#6B6B6B] mb-2 uppercase tracking-widest">Phase 02</div>
                <h2 className="sans-text text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[#111]">Identify Deep Friction.</h2>
                <p className="sans-text text-sm sm:text-lg text-[#6B6B6B] leading-relaxed">
                  We pinpoint exact moments of user failure, like hidden layout shifts or critical drop-off nodes in the journey.
                </p>
              </motion.div>

              <motion.div className="absolute w-full" style={{ opacity: phase3Opacity }}>
                <div className="sans-text font-bold text-[10px] text-[#6B6B6B] mb-2 uppercase tracking-widest">Phase 03</div>
                <h2 className="sans-text text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[#111]">Autonomously A/B Test.</h2>
                <p className="sans-text text-sm sm:text-lg text-[#6B6B6B] leading-relaxed">
                  Traffic is split instantly. We deploy algorithmically generated fixes against your control to measure pure conversion delta.
                </p>
              </motion.div>

              <motion.div className="absolute w-full pointer-events-auto" style={{ opacity: phase4Opacity }}>
                <div className="sans-text font-bold text-[10px] text-[#6B6B6B] mb-2 uppercase tracking-widest">Phase 04</div>
                <h2 className="sans-text text-4xl sm:text-5xl font-bold tracking-tighter mb-4 text-[#111]">Prove Significance.</h2>
                <p className="sans-text text-sm sm:text-lg text-[#6B6B6B] leading-relaxed mb-8">
                  Ship confident, data-backed optimizations that directly impact your bottom line.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="sans-text text-sm uppercase tracking-widest font-bold px-8 py-4 border border-[#111] bg-[#111] text-[#FAFAF8] hover:bg-transparent hover:text-[#111] transition-colors cursor-pointer"
                >
                  Initialize Zybit
                </button>
              </motion.div>

            </div>

            {/* Right side: The Mock Website Animation */}
            <div className="flex-[1.5] w-full max-w-[800px]">
              <MockWebsite scrollYProgress={scrollYProgress} />
            </div>

            {/* Mobile text — inline below mock, all phases share identical pixel space */}
            <div className="lg:hidden relative w-full h-28 px-4">
              <motion.div className="absolute inset-0 grid place-items-center text-center" style={{ opacity: heroOpacity }}>
                <div>
                  <h2 className="sans-text text-2xl font-bold tracking-tight text-[#111]">See it in action.</h2>
                  <p className="sans-text text-sm text-[#6B6B6B] mt-1">Scroll to begin.</p>
                </div>
              </motion.div>
              <motion.div className="absolute inset-0 grid place-items-center text-center" style={{ opacity: phase1Opacity }}>
                <div>
                  <div className="sans-text text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest">Phase 01</div>
                  <h2 className="sans-text text-2xl font-bold tracking-tight text-[#111] mt-1">Extract Design DNA.</h2>
                </div>
              </motion.div>
              <motion.div className="absolute inset-0 grid place-items-center text-center" style={{ opacity: phase2Opacity }}>
                <div>
                  <div className="sans-text text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest">Phase 02</div>
                  <h2 className="sans-text text-2xl font-bold tracking-tight text-[#111] mt-1">Identify Deep Friction.</h2>
                </div>
              </motion.div>
              <motion.div className="absolute inset-0 grid place-items-center text-center" style={{ opacity: phase3Opacity }}>
                <div>
                  <div className="sans-text text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest">Phase 03</div>
                  <h2 className="sans-text text-2xl font-bold tracking-tight text-[#111] mt-1">Autonomously A/B Test.</h2>
                </div>
              </motion.div>
              <motion.div className="absolute inset-0 grid place-items-center text-center pointer-events-auto" style={{ opacity: phase4Opacity }}>
                <div>
                  <div className="sans-text text-[9px] font-bold text-[#6B6B6B] uppercase tracking-widest mb-1">Phase 04</div>
                  <div className="sans-text text-4xl font-black tracking-tighter text-[#111] leading-none mb-3">+14.2%</div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="sans-text text-sm uppercase tracking-widest font-bold px-6 py-3 border border-[#111] bg-[#111] text-[#FAFAF8] hover:bg-transparent hover:text-[#111] transition-colors cursor-pointer"
                  >
                    Initialize Zybit
                  </button>
                </div>
              </motion.div>
            </div>

          </div>

        </div>
      </div>

      <IntakeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

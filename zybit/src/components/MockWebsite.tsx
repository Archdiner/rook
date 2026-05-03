"use client";

import React, { useState, useEffect } from "react";
import { motion, MotionValue, useTransform } from "framer-motion";

export function MockWebsite({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  // Phase 1: Scanner (0.0 to 0.25)
  const scannerY = useTransform(scrollYProgress, [0, 0.25], ["0%", "100%"]);
  const scannerOpacity = useTransform(scrollYProgress, [0, 0.05, 0.2, 0.25], [0, 1, 1, 0]);

  // Phase 2: Friction (0.25 to 0.5)
  const cursorsOpacity = useTransform(scrollYProgress, [0.25, 0.3, 0.45, 0.5], [0, 1, 1, 0]);
  const rageClickScale = useTransform(scrollYProgress, [0.35, 0.4, 0.45], [1, 1.5, 1]);
  const rageClickOpacity = useTransform(scrollYProgress, [0.35, 0.4, 0.45], [0, 1, 0]);

  // Phase 3: Split (0.5 to 0.75)
  const splitGap = useTransform(scrollYProgress, [0.5, 0.55], ["0%", "4%"]);
  const leftWidth = useTransform(scrollYProgress, [0.5, 0.55], ["100%", "48%"]);
  const rightWidth = useTransform(scrollYProgress, [0.5, 0.55], ["0%", "48%"]);
  const rightOpacity = useTransform(scrollYProgress, [0.5, 0.55], [0, 1]);
  const variantOpacity = useTransform(scrollYProgress, [0.55, 0.6], [0, 1]);

  // Phase 4: Chart (0.75 to 1.0)
  const chartOpacity = useTransform(scrollYProgress, [0.75, 0.8], [0, 1]);
  const chartY = useTransform(scrollYProgress, [0.75, 0.8], ["20px", "0px"]);

  // We need a little hack for cursors moving continuously during phase 2
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    let t = 0;
    const interval = setInterval(() => {
      t += 0.05;
      setCursorPos({
        x: Math.sin(t) * 40 + 50,
        y: Math.cos(t * 1.5) * 30 + 50
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-4xl aspect-[16/10] mx-auto flex items-center justify-center pointer-events-none">
      
      {/* Container that splits into two */}
      <motion.div className="w-full h-full flex justify-between absolute" style={{ gap: splitGap }}>
        
        {/* Left Variant (Control) */}
        <motion.div 
          className="h-full bg-white border border-[#111] shadow-[8px_8px_0px_rgba(17,17,17,0.05)] relative overflow-hidden flex flex-col"
          style={{ width: leftWidth }}
        >
          {/* Header */}
          <div className="h-12 border-b border-[#111] flex items-center px-6 justify-between">
            <div className="w-24 h-4 bg-[#111]/10" />
            <div className="flex gap-4">
              <div className="w-12 h-2 bg-[#111]/10" />
              <div className="w-12 h-2 bg-[#111]/10" />
              <div className="w-12 h-2 bg-[#111]/10" />
            </div>
          </div>
          
          {/* Body */}
          <div className="flex-1 flex p-6 gap-6">
            {/* Sidebar */}
            <div className="w-1/4 h-full border border-[#111]/10 hidden md:block" />
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-6 relative">
              <div className="w-3/4 h-12 bg-[#111]/10" />
              <div className="w-full h-32 border border-[#111]/10" />
              
              {/* Bad Button (Control) */}
              <div className="absolute bottom-10 right-10 w-32 h-10 border border-[#111]/20 flex items-center justify-center opacity-50">
                <span className="text-[10px] text-[#111]/50 font-mono">Checkout</span>
              </div>
            </div>
          </div>

          {/* Phase 1: Scanner Overlay */}
          <motion.div 
            className="absolute left-0 w-full h-[1px] bg-[#111]"
            style={{ top: scannerY, opacity: scannerOpacity }}
          >
            <div className="absolute top-2 left-10 bg-[#111] text-[#FAFAF8] text-[9px] px-2 py-1 font-mono">
              color: #111111
            </div>
            <div className="absolute top-2 right-10 bg-[#111] text-[#FAFAF8] text-[9px] px-2 py-1 font-mono">
              radius: 0px
            </div>
          </motion.div>

          {/* Phase 2: Friction Overlay */}
          <motion.div className="absolute inset-0 z-20" style={{ opacity: cursorsOpacity }}>
            <motion.div 
              className="absolute w-4 h-4 border border-[#111] rounded-full"
              style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
            />
            {/* Rage click indicator near the bad button */}
            <motion.div 
              className="absolute bottom-12 right-12 w-16 h-16 rounded-full border border-red-500 bg-red-500/10 flex items-center justify-center"
              style={{ scale: rageClickScale, opacity: rageClickOpacity }}
            >
              <span className="text-[8px] text-red-500 font-bold whitespace-nowrap -mt-6">ERR_RAGE_CLICK</span>
            </motion.div>
          </motion.div>

          {/* Phase 3 Label */}
          <motion.div className="absolute top-0 left-0 bg-[#111] text-[#FAFAF8] px-3 py-1 text-[10px] font-bold tracking-widest uppercase" style={{ opacity: variantOpacity }}>
            Control (Variant A)
          </motion.div>
        </motion.div>

        {/* Right Variant (Zybit Fix) */}
        <motion.div 
          className="h-full bg-white border border-[#111] shadow-[8px_8px_0px_rgba(17,17,17,0.05)] relative overflow-hidden flex flex-col"
          style={{ width: rightWidth, opacity: rightOpacity }}
        >
          {/* Phase 3 Label */}
          <motion.div className="absolute top-0 left-0 bg-[#111] text-[#FAFAF8] px-3 py-1 text-[10px] font-bold tracking-widest uppercase z-10" style={{ opacity: variantOpacity }}>
            Zybit Fix (Variant B)
          </motion.div>

          {/* Header */}
          <div className="h-12 border-b border-[#111] flex items-center px-6 justify-between">
            <div className="w-24 h-4 bg-[#111]/10" />
            <div className="flex gap-4">
              <div className="w-12 h-2 bg-[#111]/10" />
              <div className="w-12 h-2 bg-[#111]/10" />
              <div className="w-12 h-2 bg-[#111]/10" />
            </div>
          </div>
          
          {/* Body */}
          <div className="flex-1 flex p-6 gap-6">
            <div className="w-1/4 h-full border border-[#111]/10 hidden md:block" />
            <div className="flex-1 flex flex-col gap-6 relative">
              <div className="w-3/4 h-12 bg-[#111]/10" />
              <div className="w-full h-32 border border-[#111]/10" />
              
              {/* Good Button (Fix) */}
              <div className="absolute bottom-10 left-0 right-0 w-full h-14 bg-[#111] flex items-center justify-center">
                <span className="text-xs text-[#FAFAF8] font-bold uppercase tracking-widest">Checkout Now</span>
              </div>
            </div>
          </div>
        </motion.div>

      </motion.div>

      {/* Phase 4: Significance Chart Overlay */}
      <motion.div 
        className="absolute z-30 bg-white border-2 border-[#111] shadow-[16px_16px_0px_rgba(17,17,17,1)] p-8 flex flex-col items-center justify-center w-[80%] max-w-[500px]"
        style={{ opacity: chartOpacity, y: chartY }}
      >
        <div className="text-[10px] uppercase tracking-widest text-[#6B6B6B] mb-2 font-mono">Statistical Engine</div>
        <div className="text-5xl font-bold tracking-tighter text-[#111] mb-6">+14.2% Lift</div>
        
        <div className="w-full h-32 border-b border-l border-[#111] relative flex items-end gap-4 p-4">
          <div className="w-1/2 bg-[#111]/20 h-1/2" />
          <div className="w-1/2 bg-[#111] h-full relative">
            <motion.div 
              className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#111]"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              WINNER
            </motion.div>
          </div>
        </div>
        <div className="w-full flex justify-between mt-2 text-[10px] font-mono text-[#6B6B6B]">
          <span>Control</span>
          <span>Variant B</span>
        </div>
      </motion.div>

    </div>
  );
}

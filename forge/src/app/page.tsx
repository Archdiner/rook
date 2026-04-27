"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Icosahedron, Float, Environment } from "@react-three/drei";
import * as THREE from "three";
import Lenis from "lenis";

// --- Smooth Scrolling Setup ---
function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}

// --- Scene Background (Subtle Glow) ---
function SceneBackground() {
  return (
    <div className="canvas-container">
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(255,74,90,0.03) 0%, rgba(250,250,248,0) 70%)', filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(0,229,255,0.03) 0%, rgba(250,250,248,0) 70%)', filter: 'blur(60px)' }} />
    </div>
  );
}

// --- Magnetic Button Component ---
function MagneticButton({ children, className, onClick, type = "button" }: { children: React.ReactNode, className?: string, onClick?: () => void, type?: "button" | "submit" }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * 0.2, y: middleY * 0.2 });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.button
      type={type}
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

// --- UI Components ---

function Header() {
  return (
    <motion.div 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
      className="px-6 py-6 md:px-12 md:py-8 flex items-center justify-between relative z-10"
    >
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-md bg-[#111]" />
        <span className="text-xl font-bold tracking-tight text-[#111] sans-text">Forge</span>
      </div>
      <div className="flex gap-6 md:gap-10 text-sm font-medium text-[#111] items-center sans-text">
        <span className="hidden md:inline cursor-pointer hover:opacity-100 opacity-60 transition-opacity">Process</span>
        <span className="hidden md:inline cursor-pointer hover:opacity-100 opacity-60 transition-opacity">Teardown</span>
        <MagneticButton className="btn-primary" onClick={() => document.getElementById('intake')?.scrollIntoView({ behavior: 'smooth' })}>
          Request Audit
        </MagneticButton>
      </div>
    </motion.div>
  );
}

function Hero() {
  return (
    <div className="px-6 py-20 md:py-40 max-w-[1200px] mx-auto relative z-10 flex flex-col items-start">
      <motion.h1 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.3 }}
        className="sans-text h1-fluid font-bold text-[#111] max-w-[900px] mb-8"
      >
        Clarity over<br/>
        <span className="text-[#6B6B6B]">
          intuition.
        </span>
      </motion.h1>

      <motion.p 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.4 }}
        className="sans-text p-fluid font-normal text-[#6B6B6B] max-w-[720px] mb-12"
      >
        We ingest 30 days of your PostHog data and deliver the exact structural changes required to lift your conversion rate. No generic best practices. Just mathematical certainty.
      </motion.p>

      <motion.div 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.5 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-6"
      >
        <MagneticButton className="btn-inverted" onClick={() => document.getElementById('intake')?.scrollIntoView({ behavior: 'smooth' })}>
          Start the audit
        </MagneticButton>
        <span className="sans-text text-sm md:text-base font-medium text-[#6B6B6B] tracking-wide">
          Accepting 10 sites this week
        </span>
      </motion.div>
    </div>
  );
}

function Methodology() {
  return (
    <div className="px-6 py-24 md:py-40 relative z-10 bg-white/40">
      <div className="max-w-[1200px] mx-auto relative">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 60 }}
          className="glass-panel p-8 md:p-16 lg:p-24 flex flex-col lg:flex-row gap-12 lg:gap-24"
        >
          <div className="flex-1">
            <h2 className="sans-text h2-fluid font-bold text-[#111] mb-8">
              Ingest.<br/>Analyze.<br/><span className="text-[#6B6B6B]">Intervene.</span>
            </h2>
            <p className="sans-text text-lg md:text-xl leading-relaxed text-[#6B6B6B]">
              We don't do design theory. We trace the behavioral footprint of your last 10,000 visitors and fix what is broken.
            </p>
          </div>

          <div className="flex-1 flex flex-col gap-10 lg:pt-6">
            {[
              { step: '01', title: 'Data Ingestion', desc: 'You provide a URL and a read-only PostHog key. We map the entire journey of your traffic over the last thirty days.' },
              { step: '02', title: 'Friction Analysis', desc: 'We isolate the rage-clicks, the dead scrolls, and the confusing UI patterns that cause visitors to drop off.' },
              { step: '03', title: 'Direct Intervention', desc: 'We deliver precise, element-level fixes that will immediately lift your conversion rate. Exact copy, exact placement.' }
            ].map((item, index) => (
              <motion.div 
                key={item.step}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ type: "spring", stiffness: 80, delay: index * 0.1 }}
                className={`flex gap-6 md:gap-8 ${index !== 2 ? 'border-b border-[var(--color-glass-border)] pb-10' : ''}`}
              >
                <div className="sans-text text-sm font-bold text-[#111] mt-2">{item.step}</div>
                <div>
                  <h3 className="sans-text text-2xl font-bold text-[#111] mb-3">{item.title}</h3>
                  <p className="sans-text text-base leading-relaxed text-[#6B6B6B] m-0">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Specimen() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const isRevealed = useTransform(scrollYProgress, [0.4, 0.6], [0, 1]);
  const transformY = useTransform(scrollYProgress, [0.4, 0.6], [20, 0]);
  const highlightWidth = useSpring(useTransform(scrollYProgress, [0.3, 0.6], ["0%", "100%"]), { stiffness: 100, damping: 20 });

  return (
    <div ref={containerRef} className="px-6 py-32 md:py-48 max-w-[1200px] mx-auto relative z-10" style={{ perspective: "1000px" }}>
      <div className="text-center mb-16 md:mb-24">
        <h2 className="sans-text h2-fluid font-bold text-[#111] mb-6">
          An Interactive Teardown
        </h2>
        <p className="sans-text text-lg md:text-xl text-[#6B6B6B] max-w-[600px] mx-auto">
          Analysis 042: SaaS Pricing Page. 12,450 visits. Projected lift: +4.1%.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-16 items-center">
        {/* Text Explainer */}
        <div className="flex-1">
          <h3 className="sans-text text-3xl font-bold text-[#111] mb-6 tracking-tight">
            The hierarchy was inverted.
          </h3>
          <div className="sans-text text-lg leading-relaxed text-[#6B6B6B] mb-8">
            Users were bouncing because the tier distinction was buried under a 12-row feature matrix. 
            <span className="relative inline-block ml-1">
              <span className="relative z-10 text-[#111]">The primary CTA sat below the fold for 40% of mobile users.</span>
              <motion.span 
                style={{ scaleX: highlightWidth, transformOrigin: "left" }}
                className="absolute bottom-1 left-0 right-0 h-3 bg-[var(--color-accent-coral)] opacity-30 z-0 rounded-sm"
              />
            </span>
          </div>
          <div className="p-6 md:p-8 bg-white rounded-2xl border border-[var(--color-glass-border)] shadow-sm">
            <div className="sans-text text-xs text-[var(--color-accent-coral)] font-bold tracking-widest uppercase mb-4">The Intervention</div>
            <div className="sans-text text-lg md:text-xl text-[#111] font-medium leading-relaxed">
              Move the billing toggle directly below the $H1. Collapse the feature matrix into an expandable accordion.
            </div>
          </div>
        </div>

        {/* Visual DOM Representation - Hidden on very small mobile to prevent layout breaking, visible on md+ */}
        <div className="flex-1 relative h-[300px] md:h-[400px] w-full hidden sm:block">
          <motion.div 
            className="dom-card dom-card-before glass-card absolute w-full h-full p-6 md:p-8 flex flex-col gap-4"
          >
            <div className="w-[60%] h-8 bg-gray-200 rounded" />
            <div className="flex gap-4 flex-1">
              <div className="flex-1 border border-gray-200 rounded-lg p-4 flex flex-col">
                <div className="w-[40%] h-4 bg-gray-200 mb-6 rounded" />
                {[1,2,3,4].map(i => <div key={i} className="w-full h-2 bg-gray-100 mb-3 rounded-sm" />)}
                <div className="w-full h-8 bg-gray-200 mt-auto rounded" />
              </div>
              <div className="flex-1 border border-gray-200 rounded-lg p-4 flex flex-col">
                <div className="w-[40%] h-4 bg-gray-200 mb-6 rounded" />
                {[1,2,3,4].map(i => <div key={i} className="w-full h-2 bg-gray-100 mb-3 rounded-sm" />)}
                <div className="w-full h-8 bg-gray-200 mt-auto rounded" />
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="dom-card dom-card-after glass-card absolute w-full h-full p-6 md:p-8 flex flex-col gap-4"
            style={{ opacity: isRevealed, y: transformY }}
          >
            <div className="w-[60%] h-8 bg-[#111] rounded" />
            <div className="w-[120px] h-6 bg-[var(--color-accent-coral)] rounded-full self-start opacity-90" />
            <div className="flex gap-4 flex-1">
              <div className="flex-1 border-2 border-[#111] rounded-lg p-4 flex flex-col">
                <div className="w-[40%] h-4 bg-[#111] mb-4 rounded" />
                <div className="w-full h-10 bg-[#111] rounded mt-auto" />
              </div>
              <div className="flex-1 border-2 border-[#111] rounded-lg p-4 flex flex-col">
                <div className="w-[40%] h-4 bg-[#111] mb-4 rounded" />
                <div className="w-full h-10 bg-[var(--color-accent-coral)] rounded mt-auto" />
              </div>
            </div>
            <div className="w-full h-4 bg-gray-100 rounded mt-2" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function IntakeForm() {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !email) return;
    
    setStatus("loading");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, email })
      });
      
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <div id="intake" className="px-6 py-24 md:py-32 relative z-10">
      <div className="glass-panel max-w-[700px] mx-auto p-8 md:p-16 text-center">
        <h2 className="sans-text text-3xl md:text-5xl font-bold text-[#111] mb-6 tracking-tight">
          Let's smooth the path.
        </h2>
        <p className="sans-text text-lg text-[#6B6B6B] mb-12">
          Drop your URL below. We'll trace the friction and deliver the patch.
        </p>

        {status === "success" ? (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-8 bg-[var(--color-accent-coral)] text-white rounded-2xl font-bold text-xl"
          >
            Audit request received. We'll be in touch.
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
            <div>
              <label className="block sans-text text-sm font-bold text-[#111] mb-2 px-1">Website URL</label>
              <input 
                type="url" 
                required 
                placeholder="https://yourstartup.com" 
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="input-field"
                disabled={status === "loading"}
              />
            </div>
            <div>
              <label className="block sans-text text-sm font-bold text-[#111] mb-2 px-1">Work Email</label>
              <input 
                type="email" 
                required 
                placeholder="founder@yourstartup.com" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                disabled={status === "loading"}
              />
            </div>
            <MagneticButton type="submit" className="btn-inverted w-full mt-4 flex justify-center items-center">
              {status === "loading" ? "Submitting..." : "Request Audit"}
            </MagneticButton>
            {status === "error" && <p className="text-[var(--color-accent-coral)] text-sm mt-2 text-center">Something went wrong. Please try again.</p>}
          </form>
        )}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="px-6 py-12 md:py-16 border-t border-[var(--color-glass-border)] flex flex-col md:flex-row justify-between items-center gap-6 relative z-10 bg-[var(--color-primary-bg)]">
      <div className="flex items-center gap-4">
        <div className="w-5 h-5 rounded bg-[#111]" />
        <span className="sans-text font-bold text-[#111]">Forge</span>
      </div>
      <div className="sans-text text-sm font-medium text-[#6B6B6B]">
        forge.run · precision over intuition
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <SmoothScroll>
      <main className="p-0 m-0 relative">
        <SceneBackground />
        <Header />
        <Hero />
        <Methodology />
        <Specimen />
        <IntakeForm />
        <Footer />
      </main>
    </SmoothScroll>
  );
}

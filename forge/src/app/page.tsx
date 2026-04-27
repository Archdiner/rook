"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring, MotionValue } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Icosahedron, Float, Environment } from "@react-three/drei";
import * as THREE from "three";

// --- 3D Scene Component ---
function FluidMesh({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);
  
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 50, damping: 20 });
  
  useFrame((state, delta) => {
    if (meshRef.current && materialRef.current) {
      const progress = smoothProgress.get();
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.2 + progress * Math.PI * 2;
      meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.1 + progress * Math.PI;
      
      const baseDistort = 0.3;
      const scrollDistort = progress * 0.6;
      materialRef.current.distort = THREE.MathUtils.lerp(materialRef.current.distort, baseDistort + scrollDistort, 0.05);
      
      const color = new THREE.Color().lerpColors(
        new THREE.Color("#FF3366"),
        new THREE.Color("#00E5FF"),
        progress
      );
      materialRef.current.color = color;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <Icosahedron args={[2, 64]} ref={meshRef} position={[0, 0, -1]}>
        <MeshDistortMaterial
          ref={materialRef}
          color="#FF3366"
          envMapIntensity={1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          metalness={0.8}
          roughness={0.2}
          speed={2}
          distort={0.4}
        />
      </Icosahedron>
    </Float>
  );
}

function SceneBackground() {
  const { scrollYProgress } = useScroll();
  return (
    <div className="canvas-container">
      <Canvas camera={{ position: [0, 0, 7], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-10, -10, -5]} intensity={1.5} color="#FF3366" />
        <pointLight position={[0, -5, 10]} intensity={1} color="#00E5FF" />
        <Environment preset="city" />
        <FluidMesh scrollYProgress={scrollYProgress} />
      </Canvas>
    </div>
  );
}

// --- UI Components ---

function Header() {
  return (
    <motion.div 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
      style={{ padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 10 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #FF3366, #00E5FF)', boxShadow: '0 0 12px rgba(255, 51, 102, 0.5)' }} />
        <span style={{ fontSize: "24px", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--color-text-primary)", lineHeight: 1 }} className="serif-text">Forge</span>
      </div>
      <div style={{ display: "flex", gap: "36px", fontSize: "14px", color: "var(--color-text-primary)", alignItems: "center", fontWeight: 500 }} className="sans-text">
        <span style={{ cursor: "pointer", transition: "opacity 0.2s" }} className="hover:opacity-100 opacity-60">Process</span>
        <span style={{ cursor: "pointer", transition: "opacity 0.2s" }} className="hover:opacity-100 opacity-60">Teardown</span>
        <button className="btn-primary" onClick={() => alert('Intake form coming soon.')}>
          Request an audit
        </button>
      </div>
    </motion.div>
  );
}

function Hero() {
  return (
    <div style={{ padding: "120px 40px 160px", maxWidth: "1080px", margin: "0 auto", position: "relative", zIndex: 1 }}>
      <motion.h1 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.3 }}
        className="serif-text" 
        style={{ fontSize: "100px", fontWeight: 400, lineHeight: 0.95, letterSpacing: "-0.04em", margin: "0 0 40px", color: "var(--color-text-primary)", maxWidth: "800px" }}
      >
        Stop guessing why your users <em style={{ fontStyle: "italic", background: "-webkit-linear-gradient(0deg, #FF3366, #00E5FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>leave.</em>
      </motion.h1>

      <motion.p 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.4 }}
        className="serif-text" 
        style={{ fontSize: "24px", lineHeight: 1.5, color: "var(--color-text-muted)", margin: "0 0 56px", maxWidth: "700px", fontWeight: 400 }}
      >
        We analyze 30 days of your PostHog data to find the exact friction points killing your conversion rate. Then, we tell you exactly what to change. No generic A/B tests. Just data-backed interventions.
      </motion.p>

      <motion.div 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.5 }}
        style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap" }}
      >
        <button className="btn-inverted" onClick={() => alert('Intake form coming soon.')}>
          Start the audit →
        </button>
        <span className="sans-text" style={{ fontSize: "14px", color: "var(--color-text-muted)", letterSpacing: "0.02em" }}>
          Free in private beta · Accepting 10 sites this week
        </span>
      </motion.div>
    </div>
  );
}

function Methodology() {
  return (
    <div style={{ padding: "160px 40px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: "1080px", margin: "0 auto", position: "relative" }}>
        
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 60 }}
          className="glass-panel" 
          style={{ padding: "80px", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "80px", alignItems: "center" }}
        >
          <div>
            <h2 className="serif-text" style={{ fontSize: "64px", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.025em", margin: "0 0 32px", color: "var(--color-text-primary)" }}>
              Ingest.<br/>Analyze.<br/>Intervene.
            </h2>
            <p className="sans-text" style={{ fontSize: "18px", lineHeight: 1.6, color: "var(--color-text-muted)" }}>
              We don't do design theory. We trace the behavioral footprint of your last 10,000 visitors and fix what is broken.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {[
              { step: '01', title: 'Data Ingestion', desc: 'You provide a URL and a read-only PostHog key. We map the entire journey of your traffic over the last thirty days.' },
              { step: '02', title: 'Friction Analysis', desc: 'We isolate the rage-clicks, the dead scrolls, and the confusing UI patterns that cause visitors to drop off.' },
              { step: '03', title: 'Direct Intervention', desc: 'We deliver three precise, element-level fixes that will immediately lift your conversion rate. Exact copy, exact placement.' }
            ].map((item, index) => (
              <motion.div 
                key={item.step}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ type: "spring", stiffness: 80, delay: index * 0.1 }}
                className="glass-card"
                style={{ padding: "32px", display: "flex", gap: "24px" }}
              >
                <div className="sans-text" style={{ fontSize: "16px", color: "var(--color-accent-spring)", fontWeight: 600 }}>{item.step}</div>
                <div>
                  <h3 className="serif-text" style={{ fontSize: "24px", fontWeight: 400, margin: "0 0 8px", color: "var(--color-text-primary)" }}>{item.title}</h3>
                  <p className="sans-text" style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--color-text-muted)", margin: 0 }}>{item.desc}</p>
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

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 0.95]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [5, 0, -5]);
  
  // Clean text highlight animation instead of the broken SVG
  const highlightWidth = useSpring(useTransform(scrollYProgress, [0.3, 0.6], ["0%", "100%"]), { stiffness: 100, damping: 20 });

  return (
    <div ref={containerRef} style={{ padding: "160px 40px", maxWidth: "1080px", margin: "0 auto", position: "relative", zIndex: 2, perspective: "1000px" }}>
      <div style={{ textAlign: "center", marginBottom: "80px" }}>
        <h2 className="serif-text" style={{ fontSize: "56px", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.025em", margin: "0 0 24px", color: "var(--color-text-primary)" }}>
          A Recent Teardown
        </h2>
      </div>

      <motion.div 
        style={{ scale, rotateX }}
        className="glass-panel"
      >
        <div style={{ padding: "56px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "28px", borderBottom: "1px solid var(--color-glass-border)", marginBottom: "40px" }}>
            <div>
              <div className="sans-text" style={{ fontSize: "24px", color: "var(--color-text-primary)", fontWeight: 500 }}>SaaS Pricing Page</div>
              <div className="serif-text" style={{ fontSize: "15px", color: "var(--color-text-muted)", marginTop: "8px", fontStyle: "italic" }}>Analysis 042 · 12,450 visits over thirty days</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="sans-text" style={{ fontSize: "13px", color: "var(--color-accent-cyan)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Projected lift</div>
              <div className="sans-text" style={{ fontSize: "36px", color: "var(--color-text-primary)", fontWeight: 300, marginTop: "4px" }}>+4.1%</div>
            </div>
          </div>

          <div style={{ position: "relative", maxWidth: "800px" }}>
            <div className="sans-text" style={{ display: "inline-block", background: "var(--color-text-primary)", color: "var(--color-primary-bg)", fontSize: "11px", fontWeight: 600, padding: "6px 14px", borderRadius: "100px", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "24px" }}>Highest Leverage Fix</div>
            
            <div style={{ marginBottom: "24px", lineHeight: 1.4 }}>
              <span className="serif-text" style={{ fontSize: "32px", color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
                Users bounce because the tier distinction is buried in a feature matrix. 
                <motion.span 
                  style={{ 
                    backgroundImage: "linear-gradient(transparent 60%, rgba(255, 51, 102, 0.4) 60%)",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: useTransform(highlightWidth, (w) => `${w} 100%`),
                    display: "inline",
                    padding: "0 4px",
                    marginLeft: "8px"
                  }}
                >
                  The primary CTA is sitting below the fold for 40% of mobile users.
                </motion.span>
              </span>
            </div>

            <p className="sans-text" style={{ fontSize: "18px", lineHeight: 1.7, color: "var(--color-text-muted)", margin: "0 0 32px" }}>
              Rage clicks are concentrated on the disabled 'Pro' toggle. Visitors want to see the higher tier pricing, but the UI requires them to scroll through 12 irrelevant features first. We need to flip the hierarchy.
            </p>
            
            <div className="glass-card" style={{ borderLeft: "4px solid var(--color-accent-spring)", padding: "24px", background: "rgba(255, 51, 102, 0.05)" }}>
              <div className="sans-text" style={{ fontSize: "12px", color: "var(--color-accent-spring)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>The Intervention</div>
              <div className="serif-text" style={{ fontSize: "24px", color: "var(--color-text-primary)", fontStyle: "italic", lineHeight: 1.4 }}>
                Move the billing toggle directly below the $H1. Collapse the feature matrix into an expandable accordion.
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RoadmapTimeline() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const lineHeight = useSpring(useTransform(scrollYProgress, [0, 0.8], ["0%", "100%"]), { stiffness: 50, damping: 20 });

  const steps = [
    { phase: 'Today', title: 'We Advise', desc: 'A deep-dive, annotated teardown of your primary funnel delivered in two days.' },
    { phase: 'Soon', title: 'We Monitor', desc: 'Continuous reading of your PostHog data, with new interventions flagged automatically.' },
    { phase: 'Later', title: 'We Test', desc: 'Experiments are pushed directly to your PostHog feature flags. We prove the lift before you commit code.' },
    { phase: 'Eventually', title: 'We Execute', desc: 'Within your guardrails, the winning variants are automatically merged into production.' }
  ];

  return (
    <div ref={containerRef} style={{ padding: "160px 40px", maxWidth: "800px", margin: "0 auto", position: "relative", zIndex: 1 }}>
      <h2 className="serif-text" style={{ fontSize: "56px", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.025em", margin: "0 0 80px", color: "var(--color-text-primary)", textAlign: "center" }}>
        Where this is going
      </h2>

      <div style={{ position: "relative", paddingLeft: "40px" }}>
        {/* The Animated Timeline Line */}
        <div style={{ position: "absolute", left: "0", top: "0", bottom: "0", width: "2px", background: "var(--color-glass-border)" }} />
        <motion.div 
          style={{ 
            position: "absolute", left: "0", top: "0", width: "2px", 
            background: "linear-gradient(to bottom, #FF3366, #00E5FF)",
            height: useTransform(lineHeight, (h) => h)
          }} 
        />

        {steps.map((item, index) => {
          // Calculate when this specific step should light up based on scroll
          const startTrigger = index * 0.25;
          const isActive = useTransform(scrollYProgress, [startTrigger, startTrigger + 0.1], [0.3, 1]);
          const scale = useTransform(scrollYProgress, [startTrigger, startTrigger + 0.1], [0.8, 1]);

          return (
            <motion.div key={item.phase} style={{ position: "relative", marginBottom: "64px", opacity: isActive }}>
              <motion.div style={{ position: "absolute", left: "-45px", top: "2px", width: "12px", height: "12px", borderRadius: "50%", background: "#00E5FF", scale }} />
              <div className="sans-text" style={{ fontSize: "14px", color: "var(--color-accent-cyan)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>{item.phase}</div>
              <div className="serif-text" style={{ fontSize: "28px", color: "var(--color-text-primary)", lineHeight: 1.3, marginBottom: "12px" }}>{item.title}</div>
              <div className="sans-text" style={{ fontSize: "16px", color: "var(--color-text-muted)", lineHeight: 1.6, maxWidth: "500px" }}>{item.desc}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Note() {
  return (
    <div style={{ padding: "80px 40px 160px", position: "relative", zIndex: 1 }}>
      <div className="glass-panel" style={{ maxWidth: "800px", margin: "0 auto", padding: "80px" }}>
        <p className="serif-text" style={{ fontSize: "32px", lineHeight: 1.45, color: "var(--color-text-primary)", margin: "0 0 32px", fontWeight: 400, letterSpacing: "-0.012em", textAlign: "center" }}>
          Most teams waste months A/B testing button colors while bleeding users from a confusing headline.
        </p>
        <p className="serif-text" style={{ fontSize: "20px", lineHeight: 1.65, color: "var(--color-text-muted)", margin: "0 0 32px", textAlign: "center" }}>
          We built Forge to eliminate the guesswork. We find the leak first, and we give you the exact patch.
        </p>
        <div style={{ textAlign: "center" }}>
          <button className="btn-inverted" onClick={() => alert('Intake form coming soon.')}>
            Start the audit
          </button>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ padding: "48px 40px", borderTop: "1px solid var(--color-glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1, background: "var(--color-primary-bg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg, #FF3366, #00E5FF)' }} />
        <span className="serif-text" style={{ fontSize: "16px", color: "var(--color-text-primary)" }}>Forge</span>
      </div>
      <div className="sans-text" style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
        forge.run · data-backed interventions
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main style={{ padding: 0, margin: 0, position: "relative" }}>
      <SceneBackground />
      <Header />
      <Hero />
      <Methodology />
      <Specimen />
      <RoadmapTimeline />
      <Note />
      <Footer />
    </main>
  );
}

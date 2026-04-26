"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

function Header() {
  return (
    <div style={{ padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
        <svg width="20" height="22" viewBox="0 0 32 32" style={{ display: "block" }}>
          <path d="M6 22 Q4 18 8 14 Q12 10 18 12 Q24 14 26 18 Q24 22 18 22 Q14 24 10 22 Z" fill="var(--color-inverted-bg)"/>
          <path d="M22 13 L30 11 L22 16 Z" fill="var(--color-inverted-bg)"/>
          <circle cx="20" cy="14" r="0.9" fill="var(--color-primary-bg)"/>
        </svg>
        <span style={{ fontSize: "22px", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--color-text-primary)", lineHeight: 1 }} className="serif-text">Forge</span>
      </div>
      <div style={{ display: "flex", gap: "36px", fontSize: "14px", color: "var(--color-text-primary)", alignItems: "center" }} className="sans-text">
        <span style={{ opacity: 0.65 }}>Method</span>
        <span style={{ opacity: 0.65 }}>Specimen</span>
        <span style={{ opacity: 0.65 }}>Almanac</span>
        <button className="btn-primary" onClick={() => alert('Survey intake form coming soon.')}>
          Request a survey
        </button>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div style={{ padding: "80px 40px 120px", maxWidth: "980px", margin: "0 auto", position: "relative", minHeight: "540px" }}>
      <div className="animate-fade-1 serif-text" style={{ fontSize: "13px", color: "var(--color-text-muted)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "48px" }}>
        Forge — The Editor
      </div>

      <h1 className="animate-fade-2 serif-text" style={{ fontSize: "92px", fontWeight: 400, lineHeight: 0.96, letterSpacing: "-0.035em", margin: "0 0 40px", color: "var(--color-text-primary)", maxWidth: "720px" }}>
        A patient reader<br/>for the part of your<br/>website you've stopped<br/><em style={{ fontStyle: "italic", color: "#D14949" }}>looking at.</em>
      </h1>

      <p className="animate-fade-3 serif-text" style={{ fontSize: "22px", lineHeight: 1.45, color: "var(--color-border-dark)", margin: "0 0 56px", maxWidth: "600px", fontWeight: 400 }}>
        We connect to your PostHog. We read your data for thirty days. We return with an annotated manuscript of the exact friction points killing your conversion rate.
      </p>

      <div className="animate-fade-3" style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={() => alert('Survey intake form coming soon.')}>
          Request a survey →
        </button>
        <span className="sans-text" style={{ fontSize: "14px", color: "var(--color-text-muted)", letterSpacing: "0.02em" }}>
          Free in private beta · twelve sites reviewed
        </span>
      </div>

      <svg className="animate-ink-line" width="100%" height="40" viewBox="0 0 980 40" style={{ position: "absolute", bottom: 0, left: 0 }} preserveAspectRatio="none">
        <path d="M40 20 Q200 12 400 22 Q600 30 800 18 Q900 14 940 22" stroke="var(--color-inverted-bg)" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.4"/>
      </svg>
    </div>
  );
}

function Methodology() {
  return (
    <div style={{ background: "var(--color-inverted-bg)", color: "var(--color-text-inverted)", padding: "140px 40px", position: "relative", overflow: "hidden" }}>
      <svg viewBox="0 0 800 200" style={{ position: "absolute", top: "60px", left: 0, width: "100%", height: "200px", opacity: 0.5 }} preserveAspectRatio="none">
        <g>
          <path d="M50 100 Q56 92 62 100 Q66 95 72 100" stroke="var(--color-text-inverted)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M180 70 Q188 60 196 70 Q200 65 208 70" stroke="var(--color-text-inverted)" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.7"/>
          <path d="M340 130 Q348 120 356 130 Q360 125 368 130" stroke="var(--color-text-inverted)" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5"/>
        </g>
      </svg>

      <div style={{ maxWidth: "900px", margin: "0 auto", position: "relative" }}>
        <div className="sans-text" style={{ fontSize: "13px", color: "#D14949", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "32px" }}>
          Method
        </div>

        <h2 className="serif-text" style={{ fontSize: "64px", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.025em", margin: "0 0 80px", color: "var(--color-text-inverted)", maxWidth: "700px" }}>
          Three things happen,<br/>in this order.
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 0 }}>
          {[
            { step: 'i', title: 'We connect.', desc: 'You provide a URL and a read-only PostHog key. We begin reading thirty days of every click, every scroll, every moment of frustration captured in your data.', time: '~ five minutes' },
            { step: 'ii', title: 'We read.', desc: 'Where visitors rage-click. Where they stop scrolling. Which button they think is interactive but isn\'t. We are unbothered by aesthetics — we care only about why people leave.', time: '~ forty hours' },
            { step: 'iii', title: 'We annotate.', desc: 'Three findings, ranked by leverage. Each tied to evidence in your own data, with the exact element identified and a suggested change. Not "consider testing a question headline." This specific sentence, on this specific button, by Tuesday.', time: '~ two days' }
          ].map((item, index) => (
            <div key={item.step} style={{ display: "grid", gridTemplateColumns: "80px 1fr 200px", gap: "40px", padding: "40px 0", borderTop: "1px solid var(--color-border-dark)", borderBottom: index === 2 ? "1px solid var(--color-border-dark)" : "none", alignItems: "start" }}>
              <div className="serif-text" style={{ fontSize: "56px", color: "var(--color-accent-gold)", lineHeight: 1, fontWeight: 400 }}>{item.step}</div>
              <div>
                <h3 className="serif-text" style={{ fontSize: "32px", fontWeight: 400, margin: "0 0 12px", color: "var(--color-text-inverted)", letterSpacing: "-0.015em" }}>{item.title}</h3>
                <p className="sans-text" style={{ fontSize: "17px", lineHeight: 1.6, color: "#9A8E76", margin: 0, maxWidth: "420px" }}>{item.desc}</p>
              </div>
              <div className="serif-text" style={{ fontStyle: "italic", fontSize: "14px", color: "#6B5C40", paddingTop: "8px" }}>{item.time}</div>
            </div>
          ))}
        </div>
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

  // The viral moment: A red editorial circle draws itself around the finding when scrolling into view
  const pathLength = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.5], [0, 1, 1]);

  return (
    <div ref={containerRef} style={{ padding: "140px 40px", maxWidth: "980px", margin: "0 auto", position: "relative" }}>
      <div className="sans-text" style={{ fontSize: "13px", color: "var(--color-text-muted)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "32px" }}>
        Specimen
      </div>

      <h2 className="serif-text" style={{ fontSize: "56px", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.025em", margin: "0 0 24px", color: "var(--color-text-primary)", maxWidth: "700px" }}>
        What we returned with,<br/>last Tuesday.
      </h2>
      <p className="sans-text" style={{ fontSize: "17px", color: "var(--color-text-muted)", margin: "0 0 64px", maxWidth: "540px", lineHeight: 1.5 }}>
        A real survey. Site name redacted. Numbers exact. We don't overwhelm you with twenty pages. We give you the highest leverage friction point to fix right now.
      </p>

      <div style={{ background: "var(--color-specimen-bg)", border: "1px solid var(--color-border)", padding: "56px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "28px", borderBottom: "1px solid var(--color-border)", marginBottom: "36px" }}>
          <div>
            <div className="sans-text" style={{ fontSize: "22px", color: "var(--color-text-primary)", fontWeight: 400 }}>stagecraft.io</div>
            <div className="serif-text" style={{ fontSize: "14px", color: "#7A6B4A", marginTop: "6px", fontStyle: "italic" }}>Survey 014 · 3,847 visits over thirty days · current conversion 1.18%</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="sans-text" style={{ fontSize: "13px", color: "#D14949", letterSpacing: "0.06em", textTransform: "uppercase" }}>Projected lift</div>
            <div className="sans-text" style={{ fontSize: "32px", color: "var(--color-text-primary)", fontWeight: 400, marginTop: "4px" }}>+2.4%</div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div className="sans-text" style={{ display: "inline-block", background: "var(--color-inverted-bg)", color: "var(--color-specimen-bg)", fontSize: "11px", padding: "4px 12px", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>Highest leverage</div>
          
          <div style={{ position: "relative" }}>
            <div className="serif-text" style={{ fontSize: "28px", color: "var(--color-text-primary)", lineHeight: 1.3, marginBottom: "16px", letterSpacing: "-0.01em", position: "relative", zIndex: 2 }}>
              The headline says what the product <em style={{ color: "#D14949" }}>is</em>. It should say what you <em style={{ color: "#D14949" }}>leave with</em>.
            </div>
            
            {/* The Viral Scroll Animation */}
            <motion.svg 
              viewBox="0 0 600 100" 
              style={{ position: "absolute", top: "-20px", left: "-20px", width: "110%", height: "140%", zIndex: 3, pointerEvents: "none", opacity }}
            >
              <motion.path
                d="M40,50 C40,20 560,20 560,50 C560,80 40,80 40,50 Z"
                fill="none"
                stroke="#D14949"
                strokeWidth="3"
                strokeLinecap="round"
                style={{ pathLength }}
                transform="rotate(-1 300 50)"
              />
              <motion.path
                d="M560,50 Q620,80 650,140"
                fill="none"
                stroke="#D14949"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="4 4"
                style={{ pathLength }}
              />
            </motion.svg>
          </div>

          <p className="sans-text" style={{ fontSize: "16px", lineHeight: 1.7, color: "var(--color-border-dark)", margin: "0 0 20px", position: "relative", zIndex: 2 }}>
            Sixty-seven of every hundred visitors leave before scrolling past the fold. The median visitor reads 18% of the page. Your headline — "AI-powered workflow automation" — pattern-matches to nine other products we've reviewed. The eye glides off it.
          </p>
          <div style={{ borderLeft: "3px solid #D14949", padding: "16px 24px", background: "var(--color-primary-bg)" }}>
            <div className="sans-text" style={{ fontSize: "12px", color: "#D14949", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Try this Tuesday</div>
            <div className="serif-text" style={{ fontSize: "22px", color: "var(--color-text-primary)", fontStyle: "italic", lineHeight: 1.4 }}>
              "Ship a week of work in an afternoon."
            </div>
          </div>
        </div>
      </div>

      <div className="serif-text" style={{ marginTop: "32px", display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
        <span>The archive contains 14 past surveys.</span>
        <span>Filed 12 April · Annotated by the founders</span>
      </div>
    </div>
  );
}

function FutureVision() {
  return (
    <div style={{ background: "#1A1612", color: "var(--color-text-inverted)", padding: "140px 40px", position: "relative" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div className="sans-text" style={{ fontSize: "13px", color: "var(--color-accent-gold)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "32px" }}>
          What comes after
        </div>

        <h2 className="serif-text" style={{ fontSize: "56px", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.025em", margin: "0 0 40px", color: "var(--color-text-inverted)", maxWidth: "720px" }}>
          The survey is how we meet.<br/>It is not what we are building.
        </h2>
        <p className="sans-text" style={{ fontSize: "19px", lineHeight: 1.6, color: "#9A8E76", margin: "0 0 80px", maxWidth: "580px" }}>
          In time, with your permission and your guardrails, the review continues. We watch your site continuously. We run experiments through your existing PostHog flags. We tell you what worked, and quietly, when you trust us enough, we begin making the changes ourselves.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "40px", paddingTop: "48px", borderTop: "1px solid var(--color-border-dark)" }}>
          {[
            { phase: 'Today', title: 'We review.', desc: 'A single annotated survey, returned in two days.' },
            { phase: 'Soon', title: 'We monitor.', desc: 'Continuous reading. New annotations each fortnight.' },
            { phase: 'Later', title: 'We test.', desc: 'Experiments run through your flags, automatically.' },
            { phase: 'Eventually', title: 'We refine.', desc: 'Within your guardrails, the changes happen overnight.' }
          ].map(item => (
            <div key={item.phase}>
              <div className="sans-text" style={{ fontSize: "13px", color: "var(--color-accent-gold)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "14px" }}>{item.phase}</div>
              <div className="serif-text" style={{ fontSize: "19px", color: "var(--color-text-inverted)", lineHeight: 1.45, marginBottom: "8px" }}>{item.title}</div>
              <div className="sans-text" style={{ fontSize: "14px", color: "#6B5C40", lineHeight: 1.55 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Note() {
  return (
    <div style={{ padding: "140px 40px", maxWidth: "800px", margin: "0 auto" }}>
      <div className="sans-text" style={{ fontSize: "13px", color: "var(--color-text-muted)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "32px" }}>
        A note from the founders
      </div>
      <p className="serif-text" style={{ fontSize: "28px", lineHeight: 1.45, color: "var(--color-text-primary)", margin: "0 0 28px", fontWeight: 400, letterSpacing: "-0.012em" }}>
        Most software is sold by being faster. We are not interested in being faster. The internet does not need a faster way to pick a button colour.
      </p>
      <p className="serif-text" style={{ fontSize: "19px", lineHeight: 1.65, color: "var(--color-border-dark)", margin: "0 0 24px" }}>
        What it needs, we think, is someone with the patience to actually look. To sit with a website for thirty days. To notice the pattern that the keeper, busy with the rest of their life, has not had time to see.
      </p>
      <p className="serif-text" style={{ fontSize: "19px", lineHeight: 1.65, color: "var(--color-text-muted)", margin: 0, fontStyle: "italic" }}>
        We will not promise lift this week. We will, in time, deliver it.
      </p>
    </div>
  );
}

function CTA() {
  return (
    <div style={{ background: "var(--color-inverted-bg)", color: "var(--color-text-inverted)", padding: "160px 40px", position: "relative", overflow: "hidden" }}>
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        <h2 className="serif-text" style={{ fontSize: "88px", fontWeight: 400, lineHeight: 0.95, letterSpacing: "-0.035em", margin: "0 0 32px", color: "var(--color-text-inverted)" }}>
          Let us read it.
        </h2>
        <p className="sans-text" style={{ fontSize: "20px", color: "#9A8E76", lineHeight: 1.55, margin: "0 0 48px", maxWidth: "480px" }}>
          Free during the private beta. We are accepting ten new sites this fortnight. The review is patient, but the waiting list is not unlimited.
        </p>
        <button className="btn-inverted" onClick={() => alert('Survey intake form coming soon.')}>
          Request a survey →
        </button>
        <div className="serif-text" style={{ marginTop: "28px", fontSize: "14px", color: "#6B5C40", fontStyle: "italic" }}>
          Two days from request to report. No card. No commitment.
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ background: "var(--color-primary-bg)", padding: "48px 40px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <svg width="18" height="20" viewBox="0 0 32 32">
          <path d="M6 22 Q4 18 8 14 Q12 10 18 12 Q24 14 26 18 Q24 22 18 22 Q14 24 10 22 Z" fill="var(--color-inverted-bg)"/>
          <path d="M22 13 L30 11 L22 16 Z" fill="var(--color-inverted-bg)"/>
        </svg>
        <span className="serif-text" style={{ fontSize: "15px", color: "var(--color-text-primary)" }}>Forge</span>
        <span className="sans-text" style={{ fontSize: "13px", color: "var(--color-text-muted)", marginLeft: "8px" }}>2026</span>
      </div>
      <div className="sans-text" style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
        forge.run · the patient reader
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main style={{ padding: 0, margin: 0, overflow: "hidden", position: "relative" }}>
      <Header />
      <Hero />
      <Methodology />
      <Specimen />
      <FutureVision />
      <Note />
      <CTA />
      <Footer />
    </main>
  );
}

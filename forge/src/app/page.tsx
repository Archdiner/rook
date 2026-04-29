"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ForgeParticleCanvas } from "@/components/forge-particle-background";

// --- Intake Form Modal ---

function IntakeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({ name: '', email: '', url: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong.');
        setStatus('error');
        return;
      }

      setStatus('success');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  const handleClose = () => {
    onClose();
    // Reset after animation
    setTimeout(() => {
      setStatus('idle');
      setFormData({ name: '', email: '', url: '' });
      setErrorMsg('');
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'modalFadeIn 0.3s ease-out',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 10, 8, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          background: '#FAFAF8',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: '16px',
          padding: '48px',
          boxShadow: '0 48px 96px -24px rgba(0,0,0,0.25)',
          animation: 'modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            color: '#6B6B6B',
            cursor: 'pointer',
            lineHeight: 1,
            padding: '4px',
          }}
        >
          ×
        </button>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <h3
              style={{
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                margin: '0 0 12px',
                color: '#111',
              }}
            >
              She&apos;s on her way.
            </h3>
            <p style={{ fontSize: '16px', color: '#6B6B6B', margin: '0 0 32px', lineHeight: 1.5 }}>
              We&apos;ll reach out within 48 hours to begin the survey. Keep an eye on your inbox.
            </p>
            <button
              onClick={handleClose}
              style={{
                background: '#111',
                color: '#FAFAF8',
                border: 'none',
                padding: '14px 32px',
                borderRadius: '100px',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h3
              style={{
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                margin: '0 0 8px',
                color: '#111',
              }}
            >
              Request a survey
            </h3>
            <p style={{ fontSize: '15px', color: '#6B6B6B', margin: '0 0 32px', lineHeight: 1.5 }}>
              Free during private beta. No card required.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  htmlFor="intake-name"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#6B6B6B',
                    marginBottom: '6px',
                    letterSpacing: '0.02em',
                  }}
                >
                  Your name
                </label>
                <input
                  id="intake-name"
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  style={{ boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label
                  htmlFor="intake-email"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#6B6B6B',
                    marginBottom: '6px',
                    letterSpacing: '0.02em',
                  }}
                >
                  Email
                </label>
                <input
                  id="intake-email"
                  type="email"
                  required
                  placeholder="jane@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  style={{ boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label
                  htmlFor="intake-url"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#6B6B6B',
                    marginBottom: '6px',
                    letterSpacing: '0.02em',
                  }}
                >
                  Website URL
                </label>
                <input
                  id="intake-url"
                  type="url"
                  required
                  placeholder="https://yoursite.com"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="input-field"
                  style={{ boxSizing: 'border-box' }}
                />
              </div>

              {status === 'error' && (
                <p style={{ fontSize: '14px', color: '#d32f2f', margin: '0', padding: '8px 12px', background: 'rgba(211,47,47,0.06)', borderRadius: '8px' }}>
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                style={{
                  marginTop: '8px',
                  background: status === 'submitting' ? '#444' : '#111',
                  color: '#FAFAF8',
                  border: 'none',
                  padding: '16px 32px',
                  borderRadius: '100px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: status === 'submitting' ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  opacity: status === 'submitting' ? 0.7 : 1,
                }}
              >
                {status === 'submitting' ? 'Sending…' : 'Start the Forge →'}
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// --- The Minimalist DOM Overlay ---

function MinimalDOM() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="w-full text-[#111]">
      {/* Hero: Data Core is compact, text can sit close below */}
      <section className="h-screen w-full flex flex-col justify-end md:justify-center px-6 md:px-24 pb-10 md:pb-0 pointer-events-none">
        <div className="max-w-[700px]">
          <h1 className="sans-text text-[2.5rem] sm:text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter mb-4 md:mb-8 leading-[0.9]">
            Clarity over<br />
            intuition.
          </h1>
          <p className="sans-text text-sm sm:text-xl md:text-2xl font-medium text-[#6B6B6B] leading-relaxed">
            <span className="text-[#111]">Forge</span> is built for teams who want product and UX changes grounded in{' '}
            <span className="text-[#111]">real user behavior</span>—not hunches. We take how people actually move through your product (paths, sessions, events) and turn that signal into{' '}
            <span className="text-[#111]">specific recommendations aimed at user pain</span>: where they stall, get confused, or leave. Not generic “redesign everything” lists. Not blank best practices. Changes you can tie back to what your data already shows is broken.
          </p>
        </div>
      </section>

      {/* Section 2: DNA is 11 units tall — text must start very low */}
      <section className="h-screen w-full flex flex-col pt-[62vh] md:pt-0 md:justify-start md:items-start px-6 md:px-24 pointer-events-none">
        <div className="max-w-[500px] md:mt-[20vh]">
          <h2 className="sans-text text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-3 md:mb-6">Pain shows up in behavior.</h2>
          <p className="sans-text text-sm sm:text-xl md:text-2xl text-[#6B6B6B] leading-relaxed">
            Drop-offs, loops, and weak journeys aren’t abstract—they’re visible in how people click, scroll, and convert (or don’t). Forge starts from that signal so you’re solving{' '}
            <span className="text-[#111]">real struggle</span>, not inventing problems to justify a roadmap.
          </p>
        </div>
      </section>

      {/* Section 3: Jet is wide but not tall — text can be higher */}
      <section className="h-screen w-full flex flex-col pt-[50vh] md:pt-0 md:justify-start md:items-end px-6 md:px-24 md:text-right pointer-events-none">
        <div className="max-w-[500px] md:mt-[20vh]">
          <h2 className="sans-text text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-3 md:mb-6">Fix what hurts users first.</h2>
          <p className="sans-text text-sm sm:text-xl md:text-2xl text-[#6B6B6B] leading-relaxed">
            Recommendations are ranked against the pain your data exposes—so engineering and design spend cycles on{' '}
            <span className="text-[#111]">relieving friction users already hit</span>, instead of shipping undifferentiated changes that don’t map to a documented problem.
          </p>
        </div>
      </section>

      {/* Section 4: Microchip is flat/wide — text can be higher */}
      <section className="h-screen w-full flex flex-col pt-[50vh] md:pt-0 md:justify-start md:items-start px-6 md:px-24 pointer-events-none">
        <div className="max-w-[500px] md:mt-[20vh]">
          <h2 className="sans-text text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-3 md:mb-6">How we define Forge.</h2>
          <p className="sans-text text-sm sm:text-xl md:text-2xl text-[#6B6B6B] leading-relaxed">
            We’re a <span className="text-[#111]">behavior-first</span> product: real usage in, readiness and ranked interventions out—each tied to evidence you can explain.{' '}
            <span className="text-[#111]">Clarity</span> means knowing which user pains deserve the next sprint; <span className="text-[#111]">intuition</span> is what we deliberately replace when the data says otherwise.
          </p>
        </div>
      </section>

      {/* Section 5: CTA */}
      <section className="h-screen w-full flex flex-col items-center justify-center text-center px-6">
        <h2 className="sans-text text-3xl sm:text-5xl md:text-8xl font-bold tracking-tighter mb-4 md:mb-6 pointer-events-none">
          Clarity over intuition—in practice.
        </h2>
        <p className="sans-text pointer-events-none mb-8 max-w-lg text-sm text-[#6B6B6B] md:mb-12 md:text-lg">
          Request a conversation—we’ll follow up on your product, your data, and whether Forge is the right way to turn user pain into prioritized work.
        </p>
        <button
          onClick={openModal}
          className="bg-[#111] text-white px-8 md:px-12 py-4 md:py-6 rounded-full sans-text text-lg md:text-2xl font-bold shadow-2xl hover:scale-105 transition-transform pointer-events-auto"
        >
          Start the Forge
        </button>
      </section>

      <IntakeModal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
}

// --- Main Application ---

export default function Home() {
  return (
    <main className="relative w-full bg-[#FAFAF8] text-[#111]">
      <header className="fixed top-0 left-0 w-full px-6 py-8 flex flex-wrap items-center justify-between gap-y-4 z-50 pointer-events-none">
        <Link href="/" className="pointer-events-auto flex items-center gap-3 no-underline">
          <div className="w-6 h-6 rounded-md bg-[#111]" />
          <span className="text-xl font-bold tracking-tight text-[#111] sans-text">Forge</span>
        </Link>
        <nav
          className="pointer-events-auto flex flex-wrap items-center justify-end gap-4 md:gap-8 sans-text"
          aria-label="Primary"
        >
          <Link
            href="/docs"
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] transition-colors hover:text-[#111]"
          >
            API
          </Link>
          <Link
            href="/discovery"
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] transition-colors hover:text-[#111]"
          >
            Discovery
          </Link>
          <Link
            href="/phase1"
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] transition-colors hover:text-[#111]"
          >
            Lab
          </Link>
        </nav>
        <div className="hidden lg:block sans-text font-bold tracking-widest uppercase text-xs text-[#6B6B6B]">
          Precision Engineering
        </div>
      </header>

      <ForgeParticleCanvas />

      <div className="relative z-10 w-full">
        <MinimalDOM />
      </div>
    </main>
  );
}

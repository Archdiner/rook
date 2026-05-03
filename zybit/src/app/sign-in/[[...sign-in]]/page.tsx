"use client";

import { SignIn } from '@clerk/nextjs';
import { AuthParticleCanvas } from '@/components/particle-background';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: '#FAFAF8',
        display: 'flex',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}
    >
      {/* Particle canvas fills the full viewport */}
      <AuthParticleCanvas />

      {/* Minimal header — same as marketing site */}
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          zIndex: 50,
          boxSizing: 'border-box',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            color: '#111',
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: '#111',
            }}
          />
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Zybit
          </span>
        </Link>
      </header>

      {/* 2-Column Layout */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          position: 'relative',
          zIndex: 10,
          width: '100%',
        }}
      >
        {/* Left Side: Branding / Copy */}
        <div
          style={{
            flex: 1,
            display: 'none',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '80px 10%',
            maxWidth: '50%',
          }}
          className="md-flex-col"
        >
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.1, color: '#111', letterSpacing: '-0.03em', marginBottom: '24px' }}>
            Welcome Back.
          </h1>
          <p style={{ fontSize: '1.25rem', color: '#555', lineHeight: 1.6, maxWidth: '400px' }}>
            Sign in to access your operations, manage workflows, and track your metrics.
          </p>
        </div>

        {/* Right Side: Clerk Auth */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px 24px',
            width: '100%',
          }}
        >
          <SignIn
            appearance={{
              variables: {
                colorBackground: '#FFFFFF',
                colorText: '#111111',
                colorPrimary: '#111111',
                colorInputBackground: '#FFFFFF',
                borderRadius: '12px',
                fontFamily: 'inherit',
              },
              elements: {
                card: {
                  boxShadow: '0 32px 64px -16px rgba(0,0,0,0.18)',
                  border: '1px solid rgba(0,0,0,0.07)',
                },
              },
            }}
            forceRedirectUrl="/dashboard"
          />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (min-width: 768px) {
          .md-flex-col {
            display: flex !important;
          }
        }
      `}} />
    </div>
  );
}

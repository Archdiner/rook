"use client";

import { SignUp } from '@clerk/nextjs';
import { ParticleCanvas } from '@/components/particle-background';
import Link from 'next/link';

export default function SignUpPage() {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: '#FAFAF8',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}
    >
      <ParticleCanvas />

      <header
        style={{
          position: 'fixed',
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
          <div style={{ width: 22, height: 22, borderRadius: 5, background: '#111' }} />
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>Zybit</span>
        </Link>
      </header>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 10,
          padding: '80px 24px 24px',
        }}
      >
        <SignUp
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
          forceRedirectUrl="/dashboard/connect"
        />
      </div>
    </div>
  );
}

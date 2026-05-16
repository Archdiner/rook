"use client";

import { SignIn } from '@clerk/nextjs';
import { AuthParticleCanvas } from '@/components/particle-background';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { hasClerkPublishableKey } from '@/lib/auth/clerkConfig';

export default function SignInPage() {
  const clerkReady = hasClerkPublishableKey();
  return (
    <div className="relative min-h-screen bg-[#FAFAF8] flex flex-col">
      <AuthParticleCanvas />

      <header className="relative z-50 w-full px-6 py-5 flex items-center">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <Logo className="w-5 h-5 text-[#111]" />
          <span className="text-lg font-bold tracking-tight text-[#111]">Zybit</span>
        </Link>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {!clerkReady ? (
            <div
              className="sans-text bg-[#FFFFFF] border-2 border-[#111] p-8 text-center"
              style={{ boxShadow: '8px 8px 0px #111' }}
            >
              <h1 className="text-xl font-bold tracking-tight text-[#111] mb-3">Sign-in is temporarily unavailable</h1>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                Authentication isn&apos;t configured for this environment yet. Please check back shortly or{' '}
                <Link href="/" className="font-semibold text-[#111] no-underline border-b border-[#111]">return home</Link>.
              </p>
            </div>
          ) : (
          <>
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
                  boxShadow: '8px 8px 0px #111',
                  border: '2px solid #111',
                },
              },
            }}
            forceRedirectUrl="/app"
          />
          <p className="mt-6 text-center text-sm text-[#6B6B6B]">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="font-semibold text-[#111] no-underline border-b border-[#111] hover:text-[#6B6B6B]">
              Sign up
            </Link>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
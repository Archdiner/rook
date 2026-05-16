// Single source of truth for whether Clerk auth is active.
//
// This MUST be the only place that decides Clerk enablement. Previously the
// ClerkProvider, server auth, and middleware each had their own check — some
// keyed on NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (inlined at build) and some on
// CLERK_SECRET_KEY (read at runtime). When only one of those was present in a
// deploy, middleware would protect /app and redirect to /sign-in while the
// ClerkProvider was NOT rendered, so the sign-in page crashed and the SPA
// bounced back to home. Keying every gate on the publishable key keeps the
// provider, server auth, and route protection perfectly in lockstep.
export function isClerkEnabled(): boolean {
  return (
    process.env.FORGE_CLERK_ENABLED === '1' &&
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  );
}

// Client-safe: FORGE_CLERK_ENABLED is server-only (not inlined into the client
// bundle), so client components can only reliably observe the publishable key,
// which is exactly what Clerk's <SignIn>/<SignUp> need to mount.
export function hasClerkPublishableKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

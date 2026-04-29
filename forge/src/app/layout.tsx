import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Forge — Clarity over intuition",
  description:
    "Forge turns real user behavior into ranked product and UX changes aimed at actual pain—stalls, confusion, drop-offs—not generic redesigns. Behavior-first decisions your team can explain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const body = <body suppressHydrationWarning>{children}</body>;

  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
      {publishableKey ? <ClerkProvider>{body}</ClerkProvider> : body}
    </html>
  );
}

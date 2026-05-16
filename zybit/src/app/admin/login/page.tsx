"use client";

import { useState } from "react";
import { Logo } from "@/components/logo";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Incorrect password.");
      }
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <Logo className="w-5 h-5 text-[#111]" />
          <span className="sans-text text-base font-bold tracking-tight text-[#111]">
            Zybit Admin
          </span>
        </div>
        <div
          className="sans-text bg-white border-2 border-[#111] p-8"
          style={{ boxShadow: "8px 8px 0px #111" }}
        >
          <h1 className="text-xl font-bold tracking-tight text-[#111] mb-6">Admin sign-in</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full border-2 border-[#111] bg-white px-4 py-3 text-sm text-[#111] placeholder-[#aaa] outline-none focus:ring-2 focus:ring-[#111]/20"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-brutalist text-[11px] py-3 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

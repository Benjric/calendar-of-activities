"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        // Deliberately not "no such account" vs "wrong password" — that
        // difference tells an attacker which addresses are real.
        setError("Incorrect email or password.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--grid-line)] bg-card px-3 py-2.5 text-sm transition-[border-color,box-shadow] focus:border-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1";

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.gov.ph"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          className={inputCls}
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--conflict)]/35 bg-[var(--conflict-bg)] px-3 py-2 text-sm text-[var(--conflict)]"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_1px_2px_-1px_oklch(0.21_0.02_260/0.3)] transition-[opacity,transform] hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

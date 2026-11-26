"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Re-keys the alert, so a second failed attempt shakes it again. */
  const [attempt, setAttempt] = useState(0);

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
        setError("Email or password is incorrect.");
        setAttempt((n) => n + 1);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-[18px]">
      {error && (
        <p
          key={attempt}
          role="alert"
          className="anim-alert rounded-[10px] border border-[var(--conflict-border)] bg-[var(--conflict-bg)] px-3.5 py-3 text-[15px] text-[var(--conflict-text)]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[15px] font-semibold">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.gov.ph"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          className="field-input h-[50px] rounded-xl px-3.5 text-base"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[15px] font-semibold">
          Password
        </label>
        <div className="field-shell flex h-[50px] items-center gap-1.5 rounded-xl border border-[var(--input)] bg-card pr-1 pl-3.5">
          <input
            id="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="press grid size-[42px] place-items-center rounded-[9px] text-muted-foreground transition-colors hover:bg-accent"
          >
            {show ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[19px]">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[19px]">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn-primary mt-2.5 min-h-[52px] rounded-xl text-[17px]"
      >
        {pending && (
          <span
            aria-hidden="true"
            className="anim-spin size-[18px] rounded-full border-[2.5px] border-white/35 border-t-white"
          />
        )}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

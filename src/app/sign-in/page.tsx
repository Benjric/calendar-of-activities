import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/sign-in-form";
import { getCurrentUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

/* The illustrative week on the brand panel. Purely decorative: example bars,
   not anyone's real activities. */
const DEMO_BARS = [
  { col: "2 / span 3", row: 1, label: "○ Training on Data Management", tone: "planned", warn: true, delay: 0.4 },
  { col: "3", row: 2, label: "Venue clash", tone: "conflict", shake: true, delay: 0.55 },
  { col: "5", row: 1, label: "○ Coaching", tone: "planned", delay: 0.7 },
  { col: "1 / span 2", row: 3, label: "● Conducted", tone: "conducted", delay: 0.85 },
  { col: "4 / span 2", row: 3, label: "→ Rescheduled", tone: "rescheduled", delay: 1 },
] as const;

const TONE = {
  planned: "border-[var(--status-planned-border)] bg-[var(--status-planned-bg)] text-[var(--status-planned)]",
  conducted: "border-[var(--status-conducted-border)] bg-[var(--status-conducted-bg)] text-[var(--status-conducted)]",
  rescheduled: "border-dashed border-[var(--status-rescheduled-border)] bg-[var(--status-rescheduled-bg)] text-[var(--status-rescheduled)]",
  conflict: "border-[var(--conflict-border)] bg-[var(--conflict-bg)] text-[var(--conflict-text)]",
} as const;

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const user = await getCurrentUser();
  if (user) redirect("/calendar");

  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/calendar";

  return (
    <div className="flex min-h-screen flex-1 flex-wrap bg-card">
      {/* Brand panel */}
      <section
        aria-hidden="true"
        className="hidden min-w-0 flex-[1_1_560px] flex-col gap-10 border-r border-[var(--grid-line)] bg-[var(--app-bg)] px-12 py-10 lg:flex"
      >
        <span className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </span>
          <span className="font-heading text-base font-semibold">Calendar of Activities</span>
        </span>

        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-8">
          <h2 className="anim-up text-[40px] leading-[1.1] tracking-[-0.03em]">
            Catch the clash{" "}
            <span className="text-[var(--faint-foreground)]">when you book it.</span>
          </h2>

          <div className="anim-float">
            <div
              className="surface-raised anim-up overflow-hidden"
              style={{ animationDelay: "0.1s" }}
            >
              <div className="grid grid-cols-5 border-b border-[var(--meter-track)] bg-[var(--weekend-bg)]">
                {["Mon 23", "Tue 24", "Wed 25", "Thu 26", "Fri 27"].map((d) => (
                  <span key={d} className="px-3 py-2.5 text-[13px] font-bold text-muted-foreground">
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-5 grid-rows-[34px_34px_34px] pt-3 pb-4">
                {DEMO_BARS.map((b) => (
                  /* Outer span places and (for the clash) shakes; the inner
                     one grows in. One element cannot run both, because the
                     inline delay would apply to each animation. */
                  <span
                    key={b.label}
                    className={`mx-1.5 my-0.5 flex ${"shake" in b ? "anim-shake" : ""}`}
                    style={{
                      gridColumn: b.col,
                      gridRow: b.row,
                      animationDelay: "shake" in b ? "1.1s" : undefined,
                    }}
                  >
                    <span
                      className={`anim-bar flex w-full items-center gap-1.5 rounded-[7px] border px-2 text-[13px] font-semibold ${TONE[b.tone]}`}
                      style={{ animationDelay: `${b.delay}s` }}
                    >
                      <span className="truncate">{b.label}</span>
                      {"warn" in b && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--conflict)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="ml-auto size-3.5 shrink-0">
                          <path d="M12 3l10 18H2z" />
                          <path d="M12 10v4M12 17.5v.01" />
                        </svg>
                      )}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form panel */}
      <main className="flex min-w-0 flex-[1_1_440px] items-center justify-center px-6 py-10 sm:px-12">
        <div
          className="anim-up flex w-full max-w-[400px] flex-col gap-7"
          style={{ animationDelay: "0.05s" }}
        >
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="text-[34px] leading-none">Sign in</h1>
            <p className="text-base text-muted-foreground">
              Use the account from your administrator.
            </p>
          </div>

          <SignInForm callbackUrl={callbackUrl} />

          <Link
            href="/"
            className="self-center text-[15px] font-semibold text-primary hover:text-[var(--primary-hover)]"
          >
            ← Back to home
          </Link>

          {process.env.NODE_ENV !== "production" && (
            <div className="rounded-xl border border-dashed border-[var(--input)] p-3.5">
              <p className="eyebrow">Development accounts</p>
              <dl className="mt-2 space-y-1.5 text-xs tabular-nums">
                {[
                  ["Program Manager", "manager@example.gov.ph", "manager1234"],
                  ["Viewer", "viewer@example.gov.ph", "viewer1234"],
                  ["Administrator", "admin@example.gov.ph", "admin1234"],
                ].map(([role, email, pw]) => (
                  <div key={email} className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="w-[108px] shrink-0 text-muted-foreground">{role}</dt>
                    <dd className="text-[var(--body-muted)]">
                      {email} · {pw}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2.5 border-t border-[var(--grid-line)] pt-2 text-xs text-muted-foreground">
                Shown only in development. Change these before the system is used.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

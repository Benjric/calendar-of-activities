import Link from "next/link";
import { redirect } from "next/navigation";

import { LandingDemo } from "@/components/landing-demo";
import { getCurrentUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    title: "Three checks before the save",
    body: "Date and venue are checked as you book. Warnings never block you.",
    tint: "bg-[var(--conflict-bg)] text-[var(--conflict)]",
    icon: (
      <>
        <path d="M12 3l10 18H2z" />
        <path d="M12 10v4M12 17.5v.01" />
      </>
    ),
  },
  {
    title: "Target against accomplishment",
    body: "Physical and financial results, each with its own gain or gap.",
    tint: "bg-[var(--status-conducted-bg)] text-[var(--status-conducted)]",
    icon: <path d="M4 20V11M10 20V4M16 20v-7M21 20H3" />,
  },
  {
    title: "Nothing quietly disappears",
    body: "Postponements keep their reasons. Dropped activities stay in the archive.",
    tint: "bg-[var(--status-rescheduled-bg)] text-[var(--status-rescheduled)]",
    icon: (
      <>
        <path d="M3 7h13a5 5 0 0 1 0 10H8" />
        <path d="M7 3L3 7l4 4" />
      </>
    ),
  },
];

const STATUS_PILL =
  "inline-flex min-h-11 items-center gap-2 rounded-full border px-[18px] text-base font-bold";

/**
 * Landing page.
 *
 * Public. A signed-in user never sees it — they go straight to the calendar,
 * because for them this is a working tool, not a pitch.
 */
export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/calendar");

  return (
    <div className="flex flex-1 flex-col bg-card">
      <header className="border-b border-[var(--grid-line)] bg-card">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-4 px-7 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-heading text-base font-semibold">Calendar of Activities</span>
              <span className="text-[13px] text-muted-foreground">Learning &amp; Development</span>
            </span>
          </Link>
          <nav aria-label="Page" className="ml-auto flex flex-wrap gap-1 text-[15px] font-medium">
            <a href="#features" className="px-3 py-3 text-[var(--body-muted)] transition-colors hover:text-primary">
              What it does
            </a>
            <a href="#accounts" className="px-3 py-3 text-[var(--body-muted)] transition-colors hover:text-primary">
              Accounts
            </a>
          </nav>
          <Link href="/sign-in" className="btn-primary px-[18px]">
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-[var(--grid-line)] bg-[var(--app-bg)]">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-7 pt-[72px] pb-20">
            <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-[22px]">
              <h1
                className="anim-up text-[38px] leading-[1.08] tracking-[-0.03em] sm:text-[50px]"
                style={{ animationDelay: "0.06s" }}
              >
                The clash is caught when you book it,{" "}
                <span className="text-[var(--faint-foreground)]">not on the day it happens.</span>
              </h1>
              <p
                className="anim-up max-w-[520px] text-lg leading-relaxed text-[var(--body-muted)]"
                style={{ animationDelay: "0.12s" }}
              >
                One calendar for every activity, from booking to accomplishment
                report.
              </p>
              <div
                className="anim-up flex flex-wrap items-center gap-4"
                style={{ animationDelay: "0.18s" }}
              >
                <Link href="/sign-in" className="btn-primary min-h-[52px] rounded-xl px-6 text-[17px]">
                  Sign in to the calendar
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="arr size-[18px]">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <span className="text-[15px] text-muted-foreground">
                  Accounts come from your administrator.
                </span>
              </div>
            </div>

            <div
              className="anim-up min-w-0 flex-[1_1_480px]"
              style={{ animationDelay: "0.15s" }}
            >
              <LandingDemo />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto flex max-w-[1240px] scroll-mt-6 flex-col gap-9 px-7 py-20">
          <h2 className="text-[34px]">What it does</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
            {FEATURES.map((f) => (
              <article key={f.title} className="feat flex flex-col gap-3.5 rounded-[18px] border border-border bg-card p-[26px]">
                <span className={`feat-ico grid size-12 place-items-center rounded-[14px] ${f.tint}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-6">
                    {f.icon}
                  </svg>
                </span>
                <h3 className="text-xl">{f.title}</h3>
                <p className="text-base leading-relaxed text-[var(--body-muted)]">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-[var(--grid-line)] bg-[var(--app-bg)]">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-7 px-7 py-16">
            <h2 className="text-[26px]">Statuses</h2>
            <div className="flex flex-wrap items-center gap-3.5">
              <span className={`${STATUS_PILL} border-[var(--status-planned-border)] bg-[var(--status-planned-bg)] text-[var(--status-planned)]`}>
                <span aria-hidden="true">○</span>Planned
              </span>
              <svg viewBox="0 0 28 16" fill="none" stroke="var(--meter-target)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-7">
                <path d="M2 8h22M18 2l6 6-6 6" />
              </svg>
              <span className={`${STATUS_PILL} border-[var(--status-conducted-border)] bg-[var(--status-conducted-bg)] text-[var(--status-conducted)]`}>
                <span aria-hidden="true">●</span>Conducted
              </span>
              <span className="text-[15px] text-muted-foreground">or</span>
              <span className={`${STATUS_PILL} border-dashed border-[var(--status-rescheduled-border)] bg-[var(--status-rescheduled-bg)] text-[var(--status-rescheduled)]`}>
                <span aria-hidden="true">→</span>Rescheduled
              </span>
              <span className="text-[15px] text-muted-foreground">or</span>
              <span className={`${STATUS_PILL} border-[var(--status-dropped-border)] bg-[var(--status-dropped-bg)] text-[var(--status-dropped)]`}>
                <span aria-hidden="true">×</span>Dropped
              </span>
            </div>
          </div>
        </section>

        <section id="accounts" className="mx-auto flex max-w-[1240px] scroll-mt-6 flex-col gap-7 px-7 py-20">
          <h2 className="text-[34px]">Accounts</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
            <article className="feat flex gap-[18px] rounded-[18px] border border-border bg-card p-[26px]">
              <span className="feat-ico grid size-[52px] shrink-0 place-items-center rounded-[14px] bg-[var(--avatar-bg)] text-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-6">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl">Program Manager</h3>
                <p className="text-base leading-relaxed text-[var(--body-muted)]">
                  Books, updates and reports activities.
                </p>
              </div>
            </article>
            <article className="feat flex gap-[18px] rounded-[18px] border border-border bg-card p-[26px]">
              <span className="feat-ico grid size-[52px] shrink-0 place-items-center rounded-[14px] bg-[var(--subtle)] text-[var(--body-muted)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-6">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl">Viewer</h3>
                <p className="text-base leading-relaxed text-[var(--body-muted)]">
                  Reads the calendar and Catch-up Plan.
                </p>
              </div>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--grid-line)]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-7 py-[22px] text-sm text-muted-foreground">
          <span>Learning &amp; Development</span>
          <Link href="/sign-in" className="ml-auto font-semibold text-primary hover:text-[var(--primary-hover)]">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}

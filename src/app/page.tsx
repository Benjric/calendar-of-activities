import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

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
    <div className="flex flex-1 flex-col">
      {/* Top bar */}
      <header className="border-b border-[var(--grid-line)] bg-card/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1520px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">
              Calendar of Activities
            </span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">
              Learning &amp; Development
            </span>
          </span>
          <Link
            href="/sign-in"
            className="ml-auto rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1520px] flex-1 px-4 sm:px-6">
        {/* Hero */}
        <section className="grid items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-20">
          <div>
            <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[42px]">
              The clash is caught when you book it,
              <br className="hidden sm:block" />{" "}
              <span className="text-muted-foreground">
                not on the day it happens.
              </span>
            </h1>

            <p className="mt-5 max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground">
              One calendar for the whole lifecycle of an activity. Book it and
              the system checks the date, the venue and every participant
              against what the office has already committed. Conduct it and the
              same record holds what was achieved against what was planned.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-in"
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] active:translate-y-px"
              >
                Sign in to the calendar
              </Link>
              <p className="text-[13px] text-muted-foreground">
                Accounts are issued by your administrator.
              </p>
            </div>
          </div>

          {/* A real fragment of the product, not an abstract graphic. */}
          <div className="surface-raised overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[var(--grid-line)] px-4 py-2.5">
              <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                Step 3 · Venue availability
              </span>
            </div>

            <div className="p-4">
              <p className="text-[11px] text-muted-foreground">Venue</p>
              <p className="mt-1 rounded-lg border border-[var(--grid-line)] px-3 py-2 text-sm">
                Conference Room A
              </p>

              <div className="mt-3 rounded-lg border border-[var(--conflict)]/35 bg-[var(--conflict-bg)] p-3.5">
                <div className="flex items-start gap-2.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--conflict)]">
                    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--conflict)]">
                      Venue already scheduled
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">
                      The selected venue is already scheduled for another
                      activity on this date.
                    </p>
                    <div className="mt-2.5 rounded-md border border-[var(--conflict)]/20 bg-card/70 px-2.5 py-1.5 text-[12px]">
                      <span className="font-medium">
                        Learning Action Cell Orientation
                      </span>
                      <span className="mt-0.5 block font-mono text-muted-foreground tabular-nums">
                        5–6 Oct 2026 · Conference Room A · CID
                      </span>
                    </div>
                    <p className="mt-2.5 rounded-md border border-[var(--conflict)]/25 bg-card/60 px-2.5 py-2 text-[13px]">
                      <span className="font-medium">Continue anyway.</span>{" "}
                      <span className="text-muted-foreground">
                        This decision is recorded against the activity.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What it does */}
        <section className="border-t border-[var(--grid-line)] py-14">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Three checks before the save
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Date, venue and participants, each run against the live
                calendar. None of them block you — a concurrent activity, a
                shared hall and a double-booked officer are all sometimes
                deliberate. The system makes the collision impossible to miss
                and records who accepted it.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Target against accomplishment
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Physical and financial variance computed separately, so an
                activity that trained more people than planned while underspending
                its budget reports both — a Notable Practice for the gain and a
                Justification for the gap, on the same record.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Nothing quietly disappears
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                A postponed activity keeps every postponement and its reason,
                and those become the catch-up plan. A dropped activity leaves
                the calendar but stays in the archive, with the reason it was
                dropped.
              </p>
            </div>
          </div>
        </section>

        {/* Who sees what */}
        <section className="border-t border-[var(--grid-line)] py-14">
          <h2 className="text-lg font-semibold tracking-tight">
            Two kinds of account
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="surface p-5">
              <h3 className="text-sm font-semibold">Program Manager</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                Books activities, runs the conflict checks, records what was
                conducted, and manages postponements and drops.
              </p>
            </div>
            <div className="surface p-5">
              <h3 className="text-sm font-semibold">Viewer</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                Reads the calendar and the catch-up plan. Cannot create or
                change anything.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--grid-line)]">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center gap-3 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span>Calendar of Activities · Learning &amp; Development</span>
          <Link
            href="/sign-in"
            className="ml-auto underline underline-offset-2 hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}

"use client";

import type { ConflictKind } from "@/generated/prisma/enums";
import type { ConflictResult } from "@/lib/conflicts";
import { formatDateRange } from "@/lib/format";

/**
 * The standing summary of all three collision checks, visible at every step.
 *
 * The checks already run against the whole selection rather than the step
 * being filled in, so the operator can see a venue clash the moment a venue
 * is chosen. Showing them only inside the step that raised them hides that:
 * someone on step 5 has no way to tell whether the date clash from step 2 is
 * still there, or whether they already accepted it.
 *
 * Every check is advisory. Concurrent activities, shared venues and
 * double-booked staff are sometimes intentional, so the job here is to make
 * a collision impossible to miss, never to block the booking.
 */

const CHECKS: { kind: ConflictKind; label: string; runsAt: number; hint: string }[] = [
  {
    kind: "DATE",
    label: "Date",
    runsAt: 2,
    hint: "Other activities already on these dates will be listed by name.",
  },
  {
    kind: "VENUE",
    label: "Venue",
    runsAt: 3,
    hint: "Only bookable venues are checked — online sessions never clash.",
  },
  {
    kind: "PARTICIPANT",
    label: "Participants",
    runsAt: 4,
    hint: "Anyone already committed to an overlapping activity is flagged by name.",
  },
];

export function CollisionChecks({
  conflicts,
  acknowledged,
  checking,
  step,
}: {
  conflicts: ConflictResult[];
  acknowledged: ConflictKind[];
  checking: boolean;
  step: number;
}) {
  return (
    <aside
      aria-label="Collision checks"
      className="surface h-fit p-5 lg:sticky lg:top-20"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-2xl">Collision checks</h2>
        {checking && (
          <span className="text-[13px] text-muted-foreground">Checking…</span>
        )}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        Run against the live calendar as you fill in each step.
      </p>

      <div className="mt-4 flex flex-col">
        {CHECKS.map((c) => {
          const found = conflicts.find((x) => x.kind === c.kind);
          const pending = step < c.runsAt;
          const clash = Boolean(found?.hasConflict);
          const accepted = clash && acknowledged.includes(c.kind);

          const badge = pending
            ? { text: `Runs at step ${c.runsAt}`, style: "bg-[var(--subtle)] text-[var(--body-muted)]" }
            : accepted
              ? { text: "Continued · recorded", style: "bg-[var(--conflict-bg)] text-[var(--conflict-text)]" }
              : clash
                ? { text: "Collision", style: "bg-[var(--conflict)] text-white" }
                : { text: "Clear", style: "bg-[var(--status-conducted-bg)] text-[var(--status-conducted)]" };

          return (
            <div
              key={c.kind}
              className="flex flex-col gap-2 border-t border-[var(--grid-line)] pt-4 pb-4 last:pb-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[15px] font-bold ${pending ? "text-[var(--body-muted)]" : ""}`}
                >
                  {c.label}
                </span>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold whitespace-nowrap ${badge.style}`}
                >
                  {badge.text}
                </span>
              </div>

              {clash && found ? (
                <>
                  <p className="text-[13px] leading-relaxed text-[var(--body-muted)]">
                    {found.message}
                  </p>
                  {found.activities.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {found.activities.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-lg bg-[var(--app-bg)] px-2.5 py-2"
                        >
                          <span className="block text-[13px] font-semibold">
                            {a.title}
                          </span>
                          <span className="block font-mono text-xs text-muted-foreground tabular-nums">
                            {[
                              formatDateRange(a.startDate, a.endDate),
                              a.leadDivisionName,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {c.hint}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 rounded-[10px] bg-[var(--app-bg)] p-3.5 text-[13px] leading-relaxed text-[var(--body-muted)]">
        <strong className="text-foreground">Every check is advisory.</strong>{" "}
        Concurrent activities, shared venues and double-booked staff are
        sometimes intentional. The system makes the collision impossible to
        miss; you decide.
      </p>
    </aside>
  );
}

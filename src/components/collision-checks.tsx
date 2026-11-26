"use client";

import type { ConflictKind } from "@/generated/prisma/enums";
import type { ConflictResult } from "@/lib/conflicts";

/**
 * The standing summary of all three collision checks, visible at every step.
 *
 * The checks run against the whole selection rather than the step being
 * filled in, so a venue clash shows the moment a venue is chosen, and someone
 * on step 5 can still see whether the date clash from step 2 is there, or
 * whether they already accepted it.
 *
 * Every check is advisory: the job is to make a collision impossible to miss,
 * never to block the booking.
 */

const CHECKS: { kind: ConflictKind; label: string; runsAt: number }[] = [
  { kind: "DATE", label: "Dates", runsAt: 2 },
  { kind: "VENUE", label: "Venue", runsAt: 3 },
  { kind: "PARTICIPANT", label: "Participants", runsAt: 4 },
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
    <section
      aria-label="Collision checks"
      className="surface flex flex-col gap-3 px-5 py-[18px]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="eyebrow font-sans">Collision checks</h2>
        {checking && (
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span aria-hidden="true" className="anim-spin size-3 rounded-full border-2 border-[var(--input)] border-t-primary" />
            Checking…
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-2.5 text-sm">
        {CHECKS.map((c) => {
          const found = conflicts.find((x) => x.kind === c.kind);
          const pending = step < c.runsAt;
          const clash = Boolean(found?.hasConflict);
          const accepted = clash && acknowledged.includes(c.kind);
          const n = found?.activities.length ?? 0;

          const { dot, text } = pending
            ? { dot: "bg-[var(--input)]", text: `checked in step ${c.runsAt}` }
            : accepted
              ? {
                  dot: "bg-[var(--status-rescheduled-solid)]",
                  text: `${n || 1} ${n === 1 || !n ? "conflict" : "conflicts"}, continued anyway`,
                }
              : clash
                ? {
                    dot: "bg-[var(--conflict)]",
                    text: `${n || 1} ${n === 1 || !n ? "conflict" : "conflicts"} to review`,
                  }
                : { dot: "bg-[var(--status-conducted-solid)]", text: "no conflicts" };

          return (
            <li key={c.kind} className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className={`mt-[5px] size-2.5 shrink-0 rounded-full transition-colors duration-300 ${dot} ${
                  clash && !accepted ? "anim-spring" : ""
                }`}
              />
              <span>
                <strong>{c.label}</strong> · {text}
                {clash && !accepted && found && found.activities.length > 0 && (
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {found.activities.map((a) => a.title).join(", ")}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-[13px] leading-normal text-muted-foreground">
        Checks warn, they never block. Anything you continue past is saved with
        the booking.
      </p>
    </section>
  );
}

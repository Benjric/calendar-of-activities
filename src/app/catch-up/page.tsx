import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { dayCount, formatDateRange } from "@/lib/format";
import { requireUser } from "@/lib/authz";
import { listCatchUpPlan } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * The catch-up plan is not a separate document — it is the accumulated
 * RescheduleRecord rows. An activity can slip more than once, and each slip
 * keeps its own reason, which is why these are rows rather than two columns.
 */
export default async function CatchUpPage() {
  await requireUser();
  const activities = await listCatchUpPlan();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] leading-none font-semibold tracking-tight">
          Catch-up Plan
        </h1>
        <p className="mt-2 max-w-[75ch] text-sm text-muted-foreground">
          Every postponed activity and its proposed new schedule. An activity
          that slips more than once keeps each postponement and its reason.
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="surface px-4 py-12 text-center">
          <p className="text-sm font-medium">Nothing postponed</p>
          <p className="mx-auto mt-1 max-w-[42ch] text-[13px] text-muted-foreground">
            Rescheduling an activity adds it here automatically.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {activities.map((a) => (
            <li key={a.id} className="surface overflow-hidden">
              <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--grid-line)] px-4 py-3">
                <Link
                  href={`/activities/${a.id}`}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {a.title}
                </Link>
                <StatusBadge status={a.status} />
                <span className="ml-auto rounded border border-[var(--grid-line)] px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {a.reschedules.length}{" "}
                  {a.reschedules.length === 1 ? "postponement" : "postponements"}
                </span>
              </div>

              <div className="px-4 py-3">
                <p className="text-[11px] text-muted-foreground">
                  Current schedule
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums">
                  {formatDateRange(a.startDate, a.endDate)}
                  <span className="ml-2 text-muted-foreground">
                    ({dayCount(a.startDate, a.endDate)}d)
                  </span>
                  {a.venue && (
                    <span className="ml-2 font-sans text-muted-foreground">
                      · {a.venue.name}
                    </span>
                  )}
                </p>

                <ol className="mt-3 space-y-2 border-t border-[var(--grid-line)] pt-3">
                  {a.reschedules.map((r) => (
                    <li key={r.id}>
                      <p className="font-mono text-[13px] tabular-nums">
                        <span className="text-muted-foreground line-through">
                          {formatDateRange(r.previousStartDate, r.previousEndDate)}
                        </span>
                        <span aria-hidden="true" className="mx-2 text-muted-foreground">→</span>
                        <span className="font-medium">
                          {formatDateRange(r.proposedStartDate, r.proposedEndDate)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {r.reasonForPostponement}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

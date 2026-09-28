import Link from "next/link";

import { buildAxis, place, summarise, toCatchUpRow } from "@/lib/catch-up";
import { formatDateRange } from "@/lib/format";
import { requireUser } from "@/lib/authz";
import { listCatchUpPlan } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** "once" and "twice" read as English; past that, a count is clearer. */
function times(n: number): string {
  if (n === 1) return "postponed once";
  if (n === 2) return "postponed twice";
  return `postponed ${n} times`;
}

/**
 * The catch-up plan is not a separate document — it is the accumulated
 * RescheduleRecord rows. An activity can slip more than once, and each slip
 * keeps its own reason, which is why these are rows rather than two columns.
 *
 * Drawn as a timeline rather than a list because the question being asked is
 * "how far has this moved?", and a pair of dates in a sentence cannot be
 * compared down a column the way two marks on a shared axis can.
 */
export default async function CatchUpPage() {
  await requireUser();
  const activities = await listCatchUpPlan();

  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );

  const rows = activities.map(toCatchUpRow);
  const summary = summarise(rows);
  const axis = buildAxis(rows, todayUTC);

  const stats = [
    { label: "Activities postponed", value: String(summary.activities) },
    { label: "Postponements in all", value: String(summary.postponements) },
    {
      label: "Average slip",
      value: summary.averageSlip === null ? "—" : `${summary.averageSlip} days`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[72ch]">
          <h1 className="font-heading text-[42px] leading-none">
            Catch-up Plan
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--body-muted)]">
            Every postponement and its reason, kept in order. An activity that
            slips twice shows both moves, so the plan can be read as a history,
            not only a list of new dates.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="surface px-4 py-12 text-center">
          <p className="text-sm font-semibold">Nothing postponed</p>
          <p className="mx-auto mt-1 max-w-[42ch] text-[13px] text-muted-foreground">
            Rescheduling an activity adds it here automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="surface flex flex-col gap-1.5 px-5 py-4">
                <span className="text-[13px] text-muted-foreground">
                  {s.label}
                </span>
                <span className="font-mono text-[32px] leading-none tabular-nums">
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          <section
            aria-label={`Postponed activities, ${axis.months[0]?.label} to ${axis.months.at(-1)?.label}`}
            className="surface overflow-x-auto"
          >
            <div className="min-w-[900px]">
              {/* Axis header */}
              <div className="grid grid-cols-[320px_minmax(0,1fr)_110px] border-b border-border bg-[var(--weekend-bg)]">
                <span className="eyebrow px-6 py-3">Activity · latest reason</span>
                <div className="relative mr-6 grid" style={{ gridTemplateColumns: axis.months.map((m) => `${m.weight}fr`).join(" ") }}>
                  {axis.months.map((m, i) => (
                    <span
                      key={`${m.label}-${i}`}
                      className="border-l border-border px-2 py-3 text-xs font-bold text-[var(--body-muted)]"
                    >
                      {m.label}
                    </span>
                  ))}
                  {axis.todayAt !== null && (
                    <span
                      className="absolute bottom-0 -translate-x-1/2 rounded-t-[4px] bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground"
                      style={{ left: `${axis.todayAt * 100}%` }}
                    >
                      Today
                    </span>
                  )}
                </div>
                <span className="eyebrow py-3 pr-6 text-right">Slipped</span>
              </div>

              {rows.map((r) => {
                const current = place(r.current, axis);
                return (
                  <div
                    key={r.id}
                    className="grid min-h-[104px] grid-cols-[320px_minmax(0,1fr)_110px] border-b border-border last:border-b-0"
                  >
                    <div className="flex flex-col gap-1 px-6 py-4">
                      <Link
                        href={`/activities/${r.id}`}
                        className="text-[15px] font-bold hover:underline"
                      >
                        {r.title}
                      </Link>
                      <span className="text-[13px] text-[var(--body-muted)]">
                        {[
                          r.divisionAcronym,
                          times(r.postponements),
                          `now ${formatDateRange(r.current.start, r.current.end)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {r.latestReason && (
                        <span className="text-[13px] text-muted-foreground italic">
                          “{r.latestReason}”
                        </span>
                      )}
                    </div>

                    <div className="relative mr-6">
                      {/* Month rules, echoing the header columns. */}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 grid"
                        style={{ gridTemplateColumns: axis.months.map((m) => `${m.weight}fr`).join(" ") }}
                      >
                        {axis.months.map((m, i) => (
                          <span key={`${m.label}-${i}`} className="border-l border-[var(--grid-line)]" />
                        ))}
                      </div>

                      {axis.todayAt !== null && (
                        <div
                          aria-hidden="true"
                          className="absolute inset-y-0 w-0.5 bg-primary/35"
                          style={{ left: `${axis.todayAt * 100}%` }}
                        />
                      )}

                      {/* Connector from each vacated slot to the next, so the
                          eye follows the move rather than inferring it. */}
                      {r.vacated.map((v, i) => {
                        const a = place(v, axis);
                        const b =
                          i + 1 < r.vacated.length
                            ? place(r.vacated[i + 1], axis)
                            : current;
                        return (
                          <div
                            key={`link-${i}`}
                            aria-hidden="true"
                            className="absolute top-1/2 border-t-[1.5px] border-dashed border-[var(--status-dropped-solid)]"
                            style={{
                              left: `${a.left + a.width}%`,
                              width: `${Math.max(0, b.left - (a.left + a.width))}%`,
                            }}
                          />
                        );
                      })}

                      {r.vacated.map((v, i) => {
                        const p = place(v, axis);
                        return (
                          <div
                            key={`vacated-${i}`}
                            title={`Vacated: ${formatDateRange(v.start, v.end)}`}
                            className="absolute top-1/2 h-4 min-w-2.5 -translate-y-1/2 rounded-[4px] border-[1.5px] border-dashed border-[var(--status-dropped-solid)] bg-card"
                            style={{ left: `${p.left}%`, width: `${p.width}%` }}
                          />
                        );
                      })}

                      <div
                        title={`Now: ${formatDateRange(r.current.start, r.current.end)}`}
                        className="absolute top-1/2 h-5 min-w-3.5 -translate-y-1/2 rounded-[5px] bg-[var(--status-rescheduled-solid)]"
                        style={{ left: `${current.left}%`, width: `${current.width}%` }}
                      />
                    </div>

                    <span className="py-4 pr-6 text-right font-mono text-[15px] tabular-nums">
                      +{r.slipDays} d
                    </span>
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center gap-6 border-t border-border px-6 py-3.5 text-[13px] text-[var(--body-muted)]">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3 w-4.5 rounded-[3px] border-[1.5px] border-dashed border-[var(--status-dropped-solid)]"
                  />
                  Vacated schedule
                </span>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3 w-4.5 rounded-[3px] bg-[var(--status-rescheduled-solid)]"
                  />
                  Current proposed schedule
                </span>
                <span className="ml-auto">
                  Each proposed schedule was re-run through the date conflict
                  check when it was entered.
                </span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

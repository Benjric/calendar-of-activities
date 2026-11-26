import Link from "next/link";

import { buildAxis, place, summarise, toCatchUpRow } from "@/lib/catch-up";
import { formatDate, formatDateRange } from "@/lib/format";
import { requireUser } from "@/lib/authz";
import { listCatchUpPlan } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** "1 postponement", "2 postponements". */
function postponements(n: number): string {
  return `${n} ${n === 1 ? "postponement" : "postponements"}`;
}

/**
 * The catch-up plan is not a separate document — it is the accumulated
 * RescheduleRecord rows. An activity can slip more than once, and each slip
 * keeps its own reason, which is why these are rows rather than two columns.
 *
 * Drawn as a timeline because the question being asked is "how far has this
 * moved?". On arrival each vacated slot drops into place, the dashed path is
 * drawn between them, and the current slot lands last.
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
  const monthCols = axis.months.map((m) => `${m.weight}fr`).join(" ");

  /* Every move with its reason, oldest first, for the per-row history. */
  const history = new Map(
    activities.map((a) => [
      a.id,
      [...a.reschedules].sort(
        (x, y) => x.previousStartDate.getTime() - y.previousStartDate.getTime(),
      ),
    ]),
  );

  const stats = [
    { label: "Activities postponed", value: String(summary.activities) },
    { label: "Postponements in all", value: String(summary.postponements) },
    {
      label: "Average slip",
      value: summary.averageSlip === null ? "—" : `${summary.averageSlip} days`,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-[22px]">
      <div className="anim-up flex max-w-[760px] flex-col gap-2.5">
        <h1 className="text-[32px] leading-tight sm:text-[38px]">Catch-up Plan</h1>
        <p className="text-[17px] leading-relaxed text-[var(--body-muted)]">
          Every postponement and its reason, kept in order. An activity that
          slips twice shows both moves, so the plan can be read as a history,
          not only a list of new dates.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="anim-up flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[var(--input)] bg-card px-6 py-12 text-center">
          <strong className="text-base">Nothing postponed</strong>
          <span className="text-[15px] text-muted-foreground">
            Rescheduling an activity adds it here automatically.
          </span>
        </div>
      ) : (
        <>
          <div
            className="anim-up grid gap-3 sm:grid-cols-3"
            style={{ animationDelay: "0.05s" }}
          >
            {stats.map((s) => (
              <div key={s.label} className="surface flex flex-col gap-1 px-[18px] py-4">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <strong className="figure text-[30px] font-semibold">{s.value}</strong>
              </div>
            ))}
          </div>

          <section
            aria-label={`Postponed activities, ${axis.months[0]?.label} to ${axis.months.at(-1)?.label}`}
            className="surface anim-up overflow-hidden"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="overflow-x-auto">
              <div className="min-w-[960px]">
                {/* Axis header */}
                <div className="grid grid-cols-[320px_minmax(0,1fr)_120px] border-b border-border bg-[var(--header-bg)]">
                  <span className="eyebrow px-[22px] py-3">Activity · latest reason</span>
                  <div className="relative grid" style={{ gridTemplateColumns: monthCols }}>
                    {axis.months.map((m, i) => (
                      <span
                        key={`${m.label}-${i}`}
                        className="border-l border-[var(--grid-line)] px-2.5 py-3 text-[13px] font-bold text-[var(--body-muted)]"
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                  <span className="eyebrow py-3 pr-[22px] pl-2.5 text-right">Slipped</span>
                </div>

                {rows.map((r, ri) => {
                  const current = place(r.current, axis);
                  const slots = [...r.vacated.map((v) => ({ v, now: false })), { v: r.current, now: true }];
                  const base = 0.25 + ri * 0.12;
                  const moves = history.get(r.id) ?? [];
                  return (
                    <div key={r.id} className="border-b border-[var(--meter-track)] transition-colors last:border-b-0 hover:bg-[var(--weekend-bg)]">
                      <div className="grid min-h-[104px] grid-cols-[320px_minmax(0,1fr)_120px] items-stretch">
                        <div className="flex flex-col gap-1.5 px-[22px] py-4">
                          <Link
                            href={`/activities/${r.id}`}
                            className="text-base font-bold hover:text-primary"
                          >
                            {r.title}
                          </Link>
                          <span className="text-sm text-muted-foreground">
                            {[r.divisionAcronym, r.venueName].filter(Boolean).join(" · ") ||
                              `now ${formatDateRange(r.current.start, r.current.end)}`}
                          </span>
                          {r.latestReason && (
                            <span className="text-sm leading-snug text-[var(--body-muted)]">
                              “{r.latestReason}”
                            </span>
                          )}
                        </div>

                        <div className="relative border-l border-[var(--grid-line)]">
                          {/* Month rules, echoing the header columns. */}
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 grid"
                            style={{ gridTemplateColumns: monthCols }}
                          >
                            {axis.months.map((m, i) => (
                              <span key={`${m.label}-${i}`} className={i ? "border-l border-[var(--meter-track)]" : ""} />
                            ))}
                          </div>

                          {axis.todayAt !== null && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-0 w-0.5 bg-primary opacity-55"
                              style={{ left: `${axis.todayAt * 100}%` }}
                            />
                          )}

                          {/* The path the activity travelled, drawn from its
                              first slot to where it sits now. */}
                          {r.vacated.length > 0 && (() => {
                            const first = place(r.vacated[0], axis);
                            const from = first.left + first.width;
                            return (
                              <span
                                aria-hidden="true"
                                className="anim-grow absolute top-1/2 h-0 border-t-2 border-dashed border-[#d9a35b]"
                                style={{
                                  left: `${from}%`,
                                  width: `${Math.max(0, current.left - from)}%`,
                                  animationDelay: `${(base + 0.05).toFixed(2)}s`,
                                }}
                              />
                            );
                          })()}

                          {slots.map(({ v, now: isNow }, i) => {
                            const p = isNow ? current : place(v, axis);
                            return (
                              <span
                                key={i}
                                title={`${isNow ? "Now" : "Vacated"}: ${formatDateRange(v.start, v.end)}`}
                                className={`anim-slot absolute top-1/2 -mt-[11px] box-border h-[22px] min-w-4 rounded-md ${
                                  isNow
                                    ? "bg-[var(--status-rescheduled-solid)] shadow-[0_4px_10px_-4px_rgb(184_115_26/0.6)]"
                                    : "border-[1.5px] border-dashed border-[var(--status-rescheduled-border)] bg-card"
                                }`}
                                style={{
                                  left: `${p.left}%`,
                                  width: `${p.width}%`,
                                  animationDelay: `${(base + i * 0.2).toFixed(2)}s`,
                                }}
                              />
                            );
                          })}
                        </div>

                        <div className="flex flex-col items-end justify-center gap-0.5 py-4 pr-[22px] pl-2.5">
                          <strong className="figure text-xl font-semibold text-[var(--status-rescheduled)]">
                            {r.slipDays} {r.slipDays === 1 ? "day" : "days"}
                          </strong>
                          <span className="text-[13px] text-muted-foreground">
                            {postponements(r.postponements)}
                          </span>
                        </div>
                      </div>

                      {moves.length > 0 && (
                        <details className="px-[22px] pb-3">
                          <summary className="-ml-2.5 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent">
                            History
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="chev size-3.5"><path d="M6 9l6 6 6-6" /></svg>
                          </summary>
                          <ol className="details-body mt-1.5 mb-2 flex flex-col gap-2.5 rounded-xl border border-dashed border-[#e8c48f] bg-[var(--status-rescheduled-wash)] px-4 py-3.5 text-sm">
                            <li className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                              <strong className="min-w-[110px]">Booked</strong>
                              <span className="text-[var(--body-muted)] tabular-nums">
                                {formatDateRange(moves[0].previousStartDate, moves[0].previousEndDate)}
                              </span>
                            </li>
                            {moves.map((m, i) => (
                              <li key={m.id} className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                                <strong className="min-w-[110px]">{i === 0 ? "Moved" : "Moved again"}</strong>
                                <span className="text-[var(--body-muted)]">
                                  <span className="tabular-nums">
                                    to {formatDateRange(m.proposedStartDate, m.proposedEndDate)}
                                  </span>{" "}
                                  · “{m.reasonForPostponement}”
                                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                                    recorded {formatDate(m.createdAt)}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-[18px] border-t border-border px-[22px] py-3.5 text-sm text-[var(--body-muted)]">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="h-3 w-[18px] rounded border-[1.5px] border-dashed border-[var(--status-rescheduled-border)] bg-card" />
                Vacated dates
              </span>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="h-3 w-[18px] rounded bg-[var(--status-rescheduled-solid)]" />
                Where it sits now
              </span>
              {axis.todayAt !== null && (
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="h-3.5 w-0.5 bg-primary" />
                  Today, {formatDate(todayUTC)}
                </span>
              )}
              <span className="ml-auto text-muted-foreground">
                Each new schedule was re-run through the date conflict check when it was entered.
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

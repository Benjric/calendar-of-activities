import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { buildMonthGrid, WEEKDAY_LABELS, normaliseMonth } from "@/lib/calendar";
import {
  dayCount,
  formatDateRange,
  monthName,
  STATUS_LABEL,
  TYPE_LABEL,
} from "@/lib/format";
import { canManageActivities, requireUser } from "@/lib/authz";
import { getSummary, listActivities, listUpcoming } from "@/lib/queries";

export const dynamic = "force-dynamic";

/*
 * Bars are told apart by fill treatment as well as hue: Conducted is the only
 * solid fill (it is settled), Planned is a flat tint (it is merely intended),
 * and Rescheduled is a dashed tint (it has already moved once). Reading the
 * month at a glance therefore never depends on separating blue from green.
 */
const STATUS_BAR = {
  PLANNED:
    "border border-[var(--status-planned-border)] bg-[var(--status-planned-bg)] text-[var(--status-planned)]",
  CONDUCTED:
    "border border-[var(--status-conducted-solid)] bg-[var(--status-conducted-solid)] text-white",
  RESCHEDULED:
    "border border-dashed border-[var(--status-rescheduled-border)] bg-[var(--status-rescheduled-bg)] text-[var(--status-rescheduled)]",
  DROPPED:
    "border border-[var(--status-dropped-border)] bg-[var(--status-dropped-bg)] text-[var(--status-dropped)]",
} as const;

/* Solid at this size — a 6px tint is invisible against the card. */
const STATUS_DOT = {
  PLANNED: "bg-[var(--status-planned-solid)]",
  CONDUCTED: "bg-[var(--status-conducted-solid)]",
  RESCHEDULED: "bg-[var(--status-rescheduled-solid)]",
  DROPPED: "bg-[var(--status-dropped-solid)]",
} as const;

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const user = await requireUser();
  const canManage = canManageActivities(user.role);
  const params = await searchParams;

  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );

  const rawYear = Number(params.y ?? now.getUTCFullYear());
  const rawMonth = Number(params.m ?? now.getUTCMonth());
  const { year, month } = normaliseMonth(
    Number.isFinite(rawYear) ? rawYear : now.getUTCFullYear(),
    Number.isFinite(rawMonth) ? rawMonth : now.getUTCMonth(),
  );

  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0));
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month + 2, 0));

  const [activities, summary, upcoming] = await Promise.all([
    listActivities({ from, to }),
    getSummary(),
    listUpcoming(todayUTC),
  ]);

  const weeks = buildMonthGrid(year, month, activities, now);

  const inMonth = activities.filter(
    (a) => a.startDate <= monthEnd && a.endDate >= monthStart,
  );

  const prev = normaliseMonth(year, month - 1);
  const next = normaliseMonth(year, month + 1);
  const isCurrentMonth =
    year === now.getUTCFullYear() && month === now.getUTCMonth();

  const stats = [
    { label: "Planned", value: summary.planned, key: "PLANNED" as const },
    { label: "Conducted", value: summary.conducted, key: "CONDUCTED" as const },
    {
      label: "Rescheduled",
      value: summary.rescheduled,
      key: "RESCHEDULED" as const,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {inMonth.length === 0
              ? "No activities"
              : `${inMonth.length} ${inMonth.length === 1 ? "activity" : "activities"}`}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-5">
            <h1 className="font-heading text-[42px] leading-none">
              {monthName(month)}{" "}
              <span className="text-muted-foreground tabular-nums">{year}</span>
            </h1>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-0.75">
              <Link
                href={`/calendar?y=${prev.year}&m=${prev.month}`}
                aria-label="Previous month"
                className="grid size-9 place-items-center rounded-[9px] text-[var(--body-muted)] transition-colors hover:bg-accent hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5"><path d="m15 18-6-6 6-6" /></svg>
              </Link>
              <Link
                href="/calendar"
                aria-current={isCurrentMonth ? "true" : undefined}
                className={`rounded-[9px] px-3.5 py-2 text-sm font-semibold transition-colors ${
                  isCurrentMonth
                    ? "bg-[var(--subtle)] text-foreground"
                    : "text-[var(--body-muted)] hover:bg-accent hover:text-foreground"
                }`}
              >
                Today
              </Link>
              <Link
                href={`/calendar?y=${next.year}&m=${next.month}`}
                aria-label="Next month"
                className="grid size-9 place-items-center rounded-[9px] text-[var(--body-muted)] transition-colors hover:bg-accent hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5"><path d="m9 18 6-6-6-6" /></svg>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="surface flex min-w-[104px] flex-col justify-center px-3 py-2"
            >
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${STATUS_DOT[s.key]}`}
                />
                {s.label}
              </span>
              <span className="mt-0.5 font-mono text-xl leading-none font-semibold tabular-nums">
                {s.value}
              </span>
            </div>
          ))}
          {canManage && summary.withOverrides > 0 && (
            <Link
              href="/conflicts"
              className="flex min-w-[104px] flex-col justify-center rounded-xl border border-[var(--conflict)]/30 bg-[var(--conflict-bg)] px-3 py-2 transition-colors hover:border-[var(--conflict)]/50"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--conflict)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true" className="size-3"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
                Conflicts
              </span>
              <span className="mt-0.5 font-mono text-xl leading-none font-semibold text-[var(--conflict)] tabular-nums">
                {summary.withOverrides}
              </span>
            </Link>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Month grid — stretches to fill the viewport down to the footer. */}
        <div className="flex min-h-[520px] flex-col overflow-x-auto">
          <div className="surface flex min-w-[820px] flex-1 flex-col overflow-hidden">
            <div className="grid shrink-0 grid-cols-7 border-b border-[var(--grid-line)]">
              {WEEKDAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`eyebrow px-3 py-2.5 ${
                    i >= 5 ? "bg-[var(--weekend-bg)]" : ""
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>

            {weeks.map((week, wi) => {
              const laneCount = week.segments.reduce(
                (max, s) => Math.max(max, s.lane + 1),
                0,
              );
              return (
                <div
                  key={wi}
                  className={`flex flex-1 flex-col ${
                    wi === weeks.length - 1
                      ? ""
                      : "border-b border-[var(--grid-line)]"
                  }`}
                >
                  <div className="relative flex flex-1 flex-col">
                    <div className="grid flex-1 grid-cols-7">
                      {week.days.map((cell, di) => (
                        <div
                          key={cell.date.toISOString()}
                          className={`border-r border-[var(--grid-line)] px-2 pt-2 pb-1 last:border-r-0 ${
                            !cell.inMonth
                              ? "bg-[var(--outside-bg)]"
                              : di >= 5
                                ? "bg-[var(--weekend-bg)]"
                                : ""
                          }`}
                          style={{ minHeight: `${54 + laneCount * 28}px` }}
                        >
                          <span
                            className={`inline-grid h-7 min-w-7 place-items-center rounded-full px-1 text-[13px] tabular-nums ${
                              cell.isToday
                                ? "bg-primary font-bold text-primary-foreground"
                                : cell.inMonth
                                  ? "font-semibold text-foreground"
                                  : "font-normal text-muted-foreground"
                            }`}
                          >
                            {cell.date.getUTCDate()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Bars sit above the cells so a multi-day activity reads
                        as one continuous span. */}
                    <div className="pointer-events-none absolute inset-x-0 top-[38px]">
                      {week.segments.map((seg) => {
                        const a = seg.item;
                        const days = dayCount(a.startDate, a.endDate);
                        return (
                          <div
                            key={`${a.id}-${seg.startCol}`}
                            className="pointer-events-auto absolute px-1"
                            style={{
                              left: `${(seg.startCol / 7) * 100}%`,
                              width: `${(seg.span / 7) * 100}%`,
                              top: `${seg.lane * 28}px`,
                            }}
                          >
                            <Link
                              href={`/activities/${a.id}`}
                              title={`${a.title} · ${formatDateRange(a.startDate, a.endDate)} · ${STATUS_LABEL[a.status]}`}
                              className={`group flex h-6 items-center gap-1.5 px-2 text-[11px] font-semibold transition-[filter,transform] hover:brightness-97 active:translate-y-px ${STATUS_BAR[a.status]} ${
                                seg.continuesLeft ? "border-l-0" : "rounded-l-[6px]"
                              } ${seg.continuesRight ? "border-r-0" : "rounded-r-[6px]"}`}
                            >
                              {seg.continuesLeft && (
                                <span aria-hidden="true" className="-ml-0.5 opacity-70">‹</span>
                              )}
                              <span className="truncate">{a.title}</span>
                              {days > 1 && !seg.continuesLeft && (
                                <span className="shrink-0 font-mono opacity-75 tabular-nums">
                                  {days}d
                                </span>
                              )}
                              {a._count.conflictOverrides > 0 && (
                                /* Solid, not a wash of the bar: three of the
                                   four bars are now tinted, and a translucent
                                   white chip disappears on all of them. */
                                <span
                                  title="Booked over a recorded conflict"
                                  className="ml-auto grid size-4 shrink-0 place-items-center rounded-[4px] bg-[var(--conflict)] text-[10px] font-extrabold text-white"
                                >
                                  !
                                </span>
                              )}
                              {seg.continuesRight && (
                                <span aria-hidden="true" className="ml-auto -mr-0.5 opacity-70">›</span>
                              )}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rail */}
        <aside className="space-y-4">
          <section className="surface overflow-hidden">
            <h2 className="border-b border-[var(--grid-line)] px-4 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              {inMonth.length > 0 ? `In ${monthName(month)}` : "Coming up"}
            </h2>

            {(inMonth.length > 0 ? inMonth : upcoming).length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium">Nothing scheduled yet</p>
                <p className="mx-auto mt-1 max-w-[30ch] text-xs text-muted-foreground">
                  {canManage
                    ? "Book an activity and the system will check the date, venue and participants against everything already committed."
                    : "Nothing has been scheduled for this period yet."}
                </p>
                {canManage && (
                  <Link
                    href="/activities/new"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--grid-line)] bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    Book an Activity
                  </Link>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-[var(--grid-line)]">
                {(inMonth.length > 0 ? inMonth : upcoming).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/activities/${a.id}`}
                      className="group block px-4 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_DOT[a.status]}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium group-hover:text-primary">
                            {a.title}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                            {formatDateRange(a.startDate, a.endDate)}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
                            {a.venue && <span className="truncate">{a.venue.name}</span>}
                            {a.leadDivision && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {a.leadDivision.acronym ?? a.leadDivision.name}
                                </span>
                              </>
                            )}
                            <span className="ml-auto rounded border border-[var(--grid-line)] px-1 py-px font-medium">
                              {TYPE_LABEL[a.type]}
                            </span>
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface px-4 py-3">
            <h2 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Legend
            </h2>
            <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
              {(
                ["PLANNED", "CONDUCTED", "RESCHEDULED", "DROPPED"] as const
              ).map((s) => (
                <li key={s}>
                  <StatusBadge status={s} />
                </li>
              ))}
            </ul>
            {/* The archive is manager-only, so a Viewer must not be sent to a
                link that just bounces them back here. */}
            <p className="mt-3 border-t border-[var(--grid-line)] pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {canManage ? (
                <>
                  Dropped activities leave the calendar but stay in the{" "}
                  <Link href="/archive" className="underline underline-offset-2 hover:text-foreground">
                    archive
                  </Link>
                  . A <span className="font-semibold">!</span> marks an activity
                  booked over a conflict someone accepted.
                </>
              ) : (
                <>Dropped activities no longer appear on the calendar.</>
              )}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

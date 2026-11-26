import Link from "next/link";

import { CalendarFilters } from "@/components/calendar-filters";
import { SelectedActivity } from "@/components/selected-activity";
import { MARK, StatusBadge } from "@/components/status-badge";
import { buildMonthGrid, WEEKDAY_LABELS, normaliseMonth } from "@/lib/calendar";
import {
  dayCount,
  formatDate,
  formatDateRange,
  monthName,
  STATUS_LABEL,
} from "@/lib/format";
import { canManageActivities, requireUser } from "@/lib/authz";
import {
  listActivities,
  listAwaitingStatus,
  listDivisions,
  listWindow,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

/*
 * Every bar is a tint with its status's own border, and a mark at its start.
 * Rescheduled is dashed as well as amber — a date that has moved is the one
 * state worth spotting without reading.
 */
const STATUS_BAR = {
  PLANNED:
    "border border-[var(--status-planned-border)] bg-[var(--status-planned-bg)] text-[var(--status-planned)]",
  CONDUCTED:
    "border border-[var(--status-conducted-border)] bg-[var(--status-conducted-bg)] text-[var(--status-conducted)]",
  RESCHEDULED:
    "border border-dashed border-[var(--status-rescheduled-border)] bg-[var(--status-rescheduled-bg)] text-[var(--status-rescheduled)]",
  DROPPED:
    "border border-[var(--status-dropped-border)] bg-[var(--status-dropped-bg)] text-[var(--status-dropped)] line-through",
} as const;

/* Solid at this size — a 6px tint is invisible against the card. */
const STATUS_DOT = {
  PLANNED: "bg-[var(--status-planned-solid)]",
  CONDUCTED: "bg-[var(--status-conducted-solid)]",
  RESCHEDULED: "bg-[var(--status-rescheduled-solid)]",
  DROPPED: "bg-[var(--status-dropped-solid)]",
} as const;

const FILTERABLE = ["PLANNED", "CONDUCTED", "RESCHEDULED"] as const;
type Filterable = (typeof FILTERABLE)[number];

/** Long form for the eyebrow: "Sunday, November 22". */
function today(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function WarnIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  );
}

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

  /*
   * Filters live in the URL rather than component state: a filtered month is
   * then a link somebody can send to the person who needs to look at it, and
   * the grid stays a Server Component.
   *
   * `hide` carries the statuses switched OFF, so the default empty URL shows
   * everything.
   */
  const hidden = new Set(
    String(params.hide ?? "")
      .split(",")
      .filter((s): s is Filterable =>
        (FILTERABLE as readonly string[]).includes(s),
      ),
  );
  const divisionId = typeof params.div === "string" ? params.div : "";
  const selectedId = typeof params.sel === "string" ? params.sel : "";

  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0));
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month + 2, 0));

  const [all, windowed, awaiting, divisions] = await Promise.all([
    listActivities({ from, to, ...(divisionId ? { divisionId } : {}) }),
    listWindow(todayUTC, 7),
    listAwaitingStatus(todayUTC),
    listDivisions(),
  ]);

  const activities = all.filter((a) => !hidden.has(a.status as Filterable));
  const weeks = buildMonthGrid(year, month, activities, now);

  const inMonth = activities.filter(
    (a) => a.startDate <= monthEnd && a.endDate >= monthStart,
  );

  /* Counts are of everything in range, not of what survived the filter —
     a chip that showed "0" whenever it was switched off could not be used
     to decide whether switching it back on is worth it. */
  const counts = FILTERABLE.reduce(
    (acc, s) => {
      acc[s] = all.filter((a) => a.status === s).length;
      return acc;
    },
    {} as Record<Filterable, number>,
  );

  const awaitingIds = new Set(awaiting.map((a) => a.id));
  const selected =
    all.find((a) => a.id === selectedId) ??
    awaiting.find((a) => a.id === selectedId) ??
    windowed.find((a) => a.id === selectedId) ??
    null;

  const prev = normaliseMonth(year, month - 1);
  const next = normaliseMonth(year, month + 1);
  const isCurrentMonth =
    year === now.getUTCFullYear() && month === now.getUTCMonth();

  /** Keeps filters and selection intact when only the month changes. */
  function monthHref(y: number, m: number) {
    const q = new URLSearchParams();
    q.set("y", String(y));
    q.set("m", String(m));
    if (hidden.size) q.set("hide", [...hidden].join(","));
    if (divisionId) q.set("div", divisionId);
    return `/calendar?${q}`;
  }

  /** Selecting a bar changes only `sel`, so filters survive the click. */
  function selectHref(id: string) {
    const q = new URLSearchParams();
    if (!isCurrentMonth) {
      q.set("y", String(year));
      q.set("m", String(month));
    }
    if (hidden.size) q.set("hide", [...hidden].join(","));
    if (divisionId) q.set("div", divisionId);
    q.set("sel", id);
    return `/calendar?${q}`;
  }

  /* Bars arrive one after another across the month, capped so a busy month
     never keeps the reader waiting. */
  let barIndex = 0;
  const barDelay = () => `${Math.min(0.15 + barIndex++ * 0.04, 0.9).toFixed(2)}s`;

  /* The phone agenda lists the month's activities by start date. */
  const agenda = [...inMonth].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );

  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <div className="anim-up flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <p className="eyebrow text-[13px]">Today · {today(todayUTC)}</p>
          <div className="flex flex-wrap items-center gap-[18px]">
            <h1 className="text-[32px] leading-none sm:text-[38px]">
              {monthName(month)}{" "}
              <span className="text-[var(--faint-foreground)] tabular-nums">{year}</span>
            </h1>
            <div className="flex items-center gap-0.5 rounded-xl border border-border bg-card p-[3px]">
              <Link
                href={monthHref(prev.year, prev.month)}
                aria-label="Previous month"
                className="press grid size-10 place-items-center rounded-[9px] text-[var(--body-muted)] transition-colors hover:bg-accent"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4.5"><path d="m15 18-6-6 6-6" /></svg>
              </Link>
              <Link
                href={monthHref(now.getUTCFullYear(), now.getUTCMonth())}
                aria-current={isCurrentMonth ? "true" : undefined}
                className={`press flex h-10 items-center rounded-[9px] px-3.5 text-sm font-semibold transition-colors ${
                  isCurrentMonth
                    ? "bg-[var(--subtle)] text-foreground"
                    : "text-[var(--body-muted)] hover:bg-accent hover:text-foreground"
                }`}
              >
                Today
              </Link>
              <Link
                href={monthHref(next.year, next.month)}
                aria-label="Next month"
                className="press grid size-10 place-items-center rounded-[9px] text-[var(--body-muted)] transition-colors hover:bg-accent"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4.5"><path d="m9 18 6-6-6-6" /></svg>
              </Link>
            </div>
          </div>
        </div>

        <p className="text-[15px] text-muted-foreground">
          {inMonth.length === 0
            ? "Nothing in this month"
            : `${inMonth.length} ${inMonth.length === 1 ? "activity" : "activities"} in ${monthName(month)}`}
        </p>
      </div>

      <div className="anim-up" style={{ animationDelay: "0.05s" }}>
        <CalendarFilters
          counts={counts}
          hidden={[...hidden]}
          divisions={divisions}
          divisionId={divisionId}
        />
      </div>

      <div className="grid min-h-0 flex-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Month grid, from tablet width up. */}
        <section
          aria-label={`${monthName(month)} ${year}`}
          className="surface anim-up hidden min-h-[520px] overflow-hidden md:block"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 border-b border-border bg-[var(--header-bg)]">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="px-3 py-2.5 text-[13px] font-bold text-muted-foreground"
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
                    className={`relative ${
                      wi === weeks.length - 1 ? "" : "border-b border-[var(--grid-line)]"
                    }`}
                  >
                    <div className="grid grid-cols-7">
                      {week.days.map((cell, di) => (
                        <div
                          key={cell.date.toISOString()}
                          className={`px-2.5 pt-2 pb-1 ${di ? "border-l border-[var(--grid-line)]" : ""} ${
                            !cell.inMonth
                              ? "bg-[var(--outside-bg)]"
                              : cell.isToday
                                ? "bg-[var(--primary-tint)]"
                                : ""
                          }`}
                          style={{ minHeight: `${Math.max(128, 46 + laneCount * 30)}px` }}
                        >
                          <span
                            className={`inline-grid size-7 place-items-center rounded-full text-sm tabular-nums ${
                              cell.isToday
                                ? "today-ring bg-primary font-bold text-primary-foreground"
                                : cell.inMonth
                                  ? "font-semibold text-foreground"
                                  : "font-semibold text-[var(--faint-foreground)]"
                            }`}
                          >
                            {cell.date.getUTCDate()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Bars sit above the cells so a multi-day activity reads
                        as one continuous span. */}
                    <div className="pointer-events-none absolute inset-x-0 top-[40px]">
                      {week.segments.map((seg) => {
                        const a = seg.item;
                        const days = dayCount(a.startDate, a.endDate);
                        const isSel = a.id === selectedId;
                        const overdue = awaitingIds.has(a.id);
                        const conflicted = a._count.conflictOverrides > 0;
                        return (
                          <div
                            key={`${a.id}-${seg.startCol}`}
                            className="pointer-events-auto absolute px-1"
                            style={{
                              left: `${(seg.startCol / 7) * 100}%`,
                              width: `${(seg.span / 7) * 100}%`,
                              top: `${seg.lane * 30}px`,
                            }}
                          >
                            <Link
                              href={selectHref(a.id)}
                              scroll={false}
                              aria-label={`${a.title}, ${formatDateRange(a.startDate, a.endDate)}, ${STATUS_LABEL[a.status]}${conflicted ? ", has a recorded conflict" : ""}`}
                              title={`${a.title} · ${formatDateRange(a.startDate, a.endDate)} · ${STATUS_LABEL[a.status]}`}
                              className={`anim-bar flex h-[26px] items-center gap-1.5 px-2 text-[13px] font-semibold transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_4px_10px_-4px_rgb(15_23_42/0.25)] ${STATUS_BAR[a.status]} ${
                                seg.continuesLeft ? "rounded-l-none border-l-0" : "rounded-l-[7px]"
                              } ${seg.continuesRight ? "rounded-r-none border-r-0" : "rounded-r-[7px]"} ${
                                isSel ? "outline-2 outline-offset-1 outline-primary" : ""
                              }`}
                              style={{ animationDelay: barDelay() }}
                            >
                              {seg.continuesLeft ? (
                                <span aria-hidden="true" className="-ml-0.5 opacity-70">‹</span>
                              ) : (
                                <span aria-hidden="true" className="font-bold">{MARK[a.status]}</span>
                              )}
                              <span className="min-w-0 flex-1 truncate">{a.title}</span>
                              {days > 1 && !seg.continuesLeft && seg.span > 1 && (
                                <span className="shrink-0 text-xs opacity-75 tabular-nums">
                                  {days}d
                                </span>
                              )}
                              {overdue && !seg.continuesLeft && (
                                <span className="shrink-0 rounded-[4px] bg-[var(--status-planned-solid)] px-1.5 py-px text-[9px] font-bold tracking-wide text-white">
                                  UPDATE
                                </span>
                              )}
                              {conflicted && (
                                <span title="Booked over a recorded conflict" className="shrink-0 text-[var(--conflict)]">
                                  <WarnIcon />
                                </span>
                              )}
                              {seg.continuesRight && (
                                <span aria-hidden="true" className="-mr-0.5 opacity-70">›</span>
                              )}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Phone agenda: a month grid at 390px is unreadable, so the same
            activities become a list. */}
        <section aria-label={`${monthName(month)} ${year} agenda`} className="flex flex-col gap-2.5 md:hidden">
          {agenda.length === 0 ? (
            <p className="surface px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing in {monthName(month)}.
            </p>
          ) : (
            agenda.map((a, i) => (
              <Link
                key={a.id}
                href={selectHref(a.id)}
                scroll={false}
                className="surface press anim-up flex flex-col gap-2 p-3.5"
                style={{ animationDelay: `${Math.min(0.1 + i * 0.04, 0.6).toFixed(2)}s` }}
              >
                <span className="flex items-center justify-between gap-2">
                  <StatusBadge status={a.status} />
                  {a._count.conflictOverrides > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--conflict-text)]">
                      <WarnIcon />
                      Conflict
                    </span>
                  )}
                </span>
                <span className="text-[17px] font-bold">{a.title}</span>
                <span className="text-sm text-muted-foreground">
                  {[
                    formatDateRange(a.startDate, a.endDate),
                    a.venue?.name,
                    a.leadDivision?.acronym ?? a.leadDivision?.name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
            ))
          )}
        </section>

        {/* Rail */}
        <aside className="flex flex-col gap-3.5">
          {selected && (
            <SelectedActivity
              key={selected.id}
              activity={selected}
              overdue={awaitingIds.has(selected.id)}
              canManage={canManage}
            />
          )}

          {/*
            Placed above "Next 7 days" on purpose: an activity that has already
            happened without a recorded outcome is the only thing on this page
            that is quietly wrong, and it outranks what is merely coming up.
          */}
          {canManage && awaiting.length > 0 && (
            <section
              className="surface anim-up overflow-hidden"
              style={{ animationDelay: "0.2s" }}
            >
              <h2 className="eyebrow border-b border-[var(--grid-line)] bg-[var(--status-rescheduled-wash)] px-[18px] py-3 font-sans text-[var(--status-rescheduled)]">
                Awaiting a status · {awaiting.length}
              </h2>
              <ul className="divide-y divide-[var(--grid-line)]">
                {awaiting.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={selectHref(a.id)}
                      scroll={false}
                      className="block px-[18px] py-3 transition-colors hover:bg-[var(--header-bg)]"
                    >
                      <span className="block text-[15px] font-semibold">
                        {a.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">
                        Ended {formatDate(a.endDate)} · still Planned
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {awaiting.length > 5 && (
                <p className="border-t border-[var(--grid-line)] px-[18px] py-2 text-[13px] text-muted-foreground">
                  and {awaiting.length - 5} more
                </p>
              )}
            </section>
          )}

          <section
            className="surface anim-up overflow-hidden"
            style={{ animationDelay: "0.25s" }}
          >
            <h2 className="eyebrow border-b border-[var(--grid-line)] px-[18px] py-3 font-sans">
              Next 7 days
            </h2>
            {windowed.length === 0 ? (
              <p className="px-[18px] py-6 text-center text-[13px] text-muted-foreground">
                Nothing scheduled this week.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--subtle)]">
                {windowed.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={selectHref(a.id)}
                      scroll={false}
                      className="flex items-start gap-3 px-[18px] py-3 transition-colors hover:bg-[var(--header-bg)]"
                    >
                      <span className="w-[78px] shrink-0 pt-px text-[13px] font-semibold text-muted-foreground tabular-nums">
                        {a.startDate <= todayUTC && a.endDate >= todayUTC
                          ? "Today"
                          : formatDateRange(a.startDate, a.endDate)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">
                          {a.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                          {[a.venue?.name, a.leadDivision?.acronym]
                            .filter(Boolean)
                            .join(" · ") || STATUS_LABEL[a.status]}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`mt-[7px] size-2 shrink-0 rounded-full ${STATUS_DOT[a.status]}`}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!selected && (
            <p className="px-1 text-[13px] text-muted-foreground">
              Pick an activity on the grid to see its details here.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

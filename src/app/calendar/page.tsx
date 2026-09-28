import Link from "next/link";

import { CalendarFilters } from "@/components/calendar-filters";
import { SelectedActivity } from "@/components/selected-activity";
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
  getSummary,
  listActivities,
  listAwaitingStatus,
  listDivisions,
  listWindow,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

/*
 * Bars are told apart by fill treatment as well as hue: Conducted is the only
 * solid fill (it is settled), Planned a flat tint (merely intended), and
 * Rescheduled a dashed tint (it has already moved once). Reading the month at
 * a glance therefore never depends on separating blue from green.
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

const FILTERABLE = ["PLANNED", "CONDUCTED", "RESCHEDULED"] as const;
type Filterable = (typeof FILTERABLE)[number];

/** Long form for the eyebrow: "Monday 28 September". */
function today(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
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
   * everything — the opposite would make "no filter" and "all filters off"
   * the same string.
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

  const [all, summary, windowed, awaiting, divisions] = await Promise.all([
    listActivities({ from, to, ...(divisionId ? { divisionId } : {}) }),
    getSummary(),
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

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Today · {today(todayUTC)}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-5">
            <h1 className="font-heading text-[42px] leading-none">
              {monthName(month)}{" "}
              <span className="text-muted-foreground tabular-nums">{year}</span>
            </h1>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-0.75">
              <Link
                href={monthHref(prev.year, prev.month)}
                aria-label="Previous month"
                className="grid size-9 place-items-center rounded-[9px] text-[var(--body-muted)] transition-colors hover:bg-accent hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5"><path d="m15 18-6-6 6-6" /></svg>
              </Link>
              <Link
                href={monthHref(now.getUTCFullYear(), now.getUTCMonth())}
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
                href={monthHref(next.year, next.month)}
                aria-label="Next month"
                className="grid size-9 place-items-center rounded-[9px] text-[var(--body-muted)] transition-colors hover:bg-accent hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5"><path d="m9 18 6-6-6-6" /></svg>
              </Link>
            </div>
          </div>
        </div>

        <p className="text-sm text-[var(--body-muted)]">
          {inMonth.length === 0
            ? "Nothing in this month"
            : `${inMonth.length} ${inMonth.length === 1 ? "activity" : "activities"} in ${monthName(month)}`}
        </p>
      </div>

      <CalendarFilters
        counts={counts}
        hidden={[...hidden]}
        divisions={divisions}
        divisionId={divisionId}
        conflicts={canManage ? summary.withOverrides : 0}
        dotClass={STATUS_DOT}
      />

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
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
                        const isSel = a.id === selectedId;
                        const overdue = awaitingIds.has(a.id);
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
                              href={selectHref(a.id)}
                              scroll={false}
                              title={`${a.title} · ${formatDateRange(a.startDate, a.endDate)} · ${STATUS_LABEL[a.status]}`}
                              className={`group flex h-6 items-center gap-1.5 px-2 text-[11px] font-semibold transition-[filter,transform] hover:brightness-97 active:translate-y-px ${STATUS_BAR[a.status]} ${
                                seg.continuesLeft ? "border-l-0" : "rounded-l-[6px]"
                              } ${seg.continuesRight ? "border-r-0" : "rounded-r-[6px]"} ${
                                isSel
                                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                                  : ""
                              }`}
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
                              {overdue && !seg.continuesLeft && (
                                <span className="shrink-0 rounded-[4px] bg-[var(--status-planned-solid)] px-1.5 py-px text-[9px] font-bold tracking-wide text-white">
                                  UPDATE
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
          {selected && (
            <SelectedActivity
              activity={selected}
              overdue={awaitingIds.has(selected.id)}
            />
          )}

          {/*
            Placed above "Next 7 days" on purpose: an activity that has already
            happened without a recorded outcome is the only thing on this page
            that is quietly wrong, and it outranks what is merely coming up.
          */}
          {canManage && awaiting.length > 0 && (
            <section className="surface overflow-hidden">
              <h2 className="eyebrow border-b border-[var(--grid-line)] px-4 py-2.5">
                Awaiting a status · {awaiting.length}
              </h2>
              <ul className="divide-y divide-[var(--grid-line)]">
                {awaiting.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={selectHref(a.id)}
                      scroll={false}
                      className="block px-4 py-2.5 transition-colors hover:bg-accent"
                    >
                      <span className="block text-sm font-semibold">
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
                <p className="border-t border-[var(--grid-line)] px-4 py-2 text-[13px] text-muted-foreground">
                  and {awaiting.length - 5} more
                </p>
              )}
            </section>
          )}

          <section className="surface overflow-hidden">
            <h2 className="eyebrow border-b border-[var(--grid-line)] px-4 py-2.5">
              Next 7 days
            </h2>
            {windowed.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                Nothing scheduled this week.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--grid-line)]">
                {windowed.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={selectHref(a.id)}
                      scroll={false}
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-accent"
                    >
                      <span className="w-[72px] shrink-0 pt-px font-mono text-xs text-[var(--body-muted)] tabular-nums">
                        {a.startDate <= todayUTC && a.endDate >= todayUTC
                          ? "Today"
                          : formatDateRange(a.startDate, a.endDate)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 text-sm font-semibold">
                            {a.title}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`mt-1.5 size-1.5 shrink-0 rounded-full ${STATUS_DOT[a.status]}`}
                          />
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                          {[a.venue?.name, a.leadDivision?.acronym]
                            .filter(Boolean)
                            .join(" · ") || STATUS_LABEL[a.status]}
                        </span>
                      </span>
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

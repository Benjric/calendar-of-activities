/**
 * Catch-up plan arithmetic.
 *
 * A postponement is only half a fact. "Moved to 21 October" says nothing about
 * whether that is a week's slip or a quarter's, and a plan made of new dates
 * alone cannot be read as a history. What follows turns the RescheduleRecord
 * rows into the two things a reader actually wants: how far each activity has
 * travelled from where it started, and where every vacated slot sat on the
 * way.
 */

const MS_PER_DAY = 86_400_000;

export interface Slot {
  start: Date;
  end: Date;
}

export interface CatchUpRow {
  id: string;
  title: string;
  divisionAcronym: string | null;
  venueName: string | null;
  /** Where it sits now. */
  current: Slot;
  /** Every slot it has been moved out of, oldest first. */
  vacated: Slot[];
  /** The most recent reason given, which is the one worth showing first. */
  latestReason: string;
  postponements: number;
  /** Days between the original start and the current one. Never negative. */
  slipDays: number;
}

interface ActivityLike {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  leadDivision: { acronym: string | null } | null;
  venue: { name: string } | null;
  reschedules: {
    previousStartDate: Date;
    previousEndDate: Date;
    reasonForPostponement: string;
  }[];
}

function days(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function toCatchUpRow(a: ActivityLike): CatchUpRow {
  // Oldest first, so `vacated[0]` is where the activity was originally booked.
  const ordered = [...a.reschedules].sort(
    (x, y) => x.previousStartDate.getTime() - y.previousStartDate.getTime(),
  );

  const vacated = ordered.map((r) => ({
    start: r.previousStartDate,
    end: r.previousEndDate,
  }));

  const origin = vacated[0]?.start ?? a.startDate;

  return {
    id: a.id,
    title: a.title,
    divisionAcronym: a.leadDivision?.acronym ?? null,
    venueName: a.venue?.name ?? null,
    current: { start: a.startDate, end: a.endDate },
    vacated,
    // The newest record carries the reason the activity is where it is now.
    latestReason: ordered.at(-1)?.reasonForPostponement ?? "",
    postponements: ordered.length,
    slipDays: Math.max(0, days(origin, a.startDate)),
  };
}

export interface CatchUpSummary {
  activities: number;
  postponements: number;
  /** Mean slip in whole days, or null when there is nothing to average. */
  averageSlip: number | null;
}

export function summarise(rows: CatchUpRow[]): CatchUpSummary {
  const postponements = rows.reduce((n, r) => n + r.postponements, 0);
  return {
    activities: rows.length,
    postponements,
    averageSlip: rows.length
      ? Math.round(rows.reduce((n, r) => n + r.slipDays, 0) / rows.length)
      : null,
  };
}

export interface Axis {
  start: Date;
  end: Date;
  months: { label: string; weight: number }[];
  /** Fraction across the axis, 0–1, or null when today falls outside it. */
  todayAt: number | null;
}

/**
 * The month axis every row is drawn against.
 *
 * Months are weighted by their real length rather than shown as equal
 * columns, so a bar's width means the same number of days wherever it sits —
 * otherwise February would silently stretch.
 */
export function buildAxis(rows: CatchUpRow[], today: Date): Axis {
  const all = rows.flatMap((r) => [
    r.current.start,
    r.current.end,
    ...r.vacated.flatMap((v) => [v.start, v.end]),
  ]);
  if (all.length === 0) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return { start, end, months: [], todayAt: null };
  }

  const min = new Date(Math.min(...all.map((d) => d.getTime())));
  const max = new Date(Math.max(...all.map((d) => d.getTime())));

  // Snap outward to whole months so the axis labels line up with its edges.
  const start = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1));
  const end = new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth() + 1, 0));

  const months: { label: string; weight: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    months.push({
      label: new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-GB", {
        month: "short",
        timeZone: "UTC",
      }),
      weight: length,
    });
    cursor.setUTCMonth(m + 1);
  }

  const span = days(start, end) || 1;
  const offset = days(start, today) / span;

  return {
    start,
    end,
    months,
    todayAt: offset >= 0 && offset <= 1 ? offset : null,
  };
}

/** A slot's left edge and width on the axis, as percentages. */
export function place(slot: Slot, axis: Axis) {
  const span = days(axis.start, axis.end) || 1;
  const left = (days(axis.start, slot.start) / span) * 100;
  // Inclusive of the end day, so a one-day slot still has width.
  const width = ((days(slot.start, slot.end) + 1) / span) * 100;
  return { left, width };
}

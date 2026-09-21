/**
 * Month grid construction.
 *
 * A multi-day activity must render as one continuous bar across the days it
 * covers, and must split cleanly where it crosses a week boundary — a three-day
 * training starting Saturday appears as a 2-day bar on one row and a 1-day bar
 * on the next, not as three disconnected chips.
 *
 * Everything here works in UTC, matching the `@db.Date` columns.
 */

const DAY_MS = 86_400_000;

export interface MonthCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
}

export interface WeekRow<T> {
  days: MonthCell[];
  /** Bars belonging to this week, already laid out into non-overlapping lanes. */
  segments: LaidOutSegment<T>[];
}

export interface Segment<T> {
  item: T;
  /** 0-6 within the week. */
  startCol: number;
  /** Number of columns covered, 1-7. */
  span: number;
  /** True when the activity began before this week. */
  continuesLeft: boolean;
  /** True when the activity runs past this week. */
  continuesRight: boolean;
}

export interface LaidOutSegment<T = unknown> extends Segment<T> {
  /** Vertical lane, so overlapping activities stack instead of colliding. */
  lane: number;
}

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Days from Monday. The office week starts Monday, not Sunday. */
function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

/**
 * Builds the visible grid for a month: whole weeks from the Monday on or before
 * the 1st, to the Sunday on or after the last day.
 */
export function buildMonthGrid<T extends { startDate: Date; endDate: Date }>(
  year: number,
  month: number,
  items: T[],
  today: Date = new Date(),
): WeekRow<T>[] {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));

  const gridStart = addDays(first, -mondayIndex(first));
  const gridEnd = addDays(last, 6 - mondayIndex(last));

  const todayUTC = startOfUTCDay(
    new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
  );

  const weeks: WeekRow<T>[] = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 7)) {
    const weekStart = cursor;
    const weekEnd = addDays(cursor, 6);

    const days: MonthCell[] = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      return {
        date,
        inMonth: date.getUTCMonth() === month,
        isToday: sameDay(date, todayUTC),
      };
    });

    // Clip each overlapping activity to this week.
    const raw: Segment<T>[] = [];
    for (const item of items) {
      const s = startOfUTCDay(item.startDate);
      const e = startOfUTCDay(item.endDate);
      if (e < weekStart || s > weekEnd) continue;

      const segStart = s < weekStart ? weekStart : s;
      const segEnd = e > weekEnd ? weekEnd : e;

      raw.push({
        item,
        startCol: Math.round((segStart.getTime() - weekStart.getTime()) / DAY_MS),
        span: Math.round((segEnd.getTime() - segStart.getTime()) / DAY_MS) + 1,
        continuesLeft: s < weekStart,
        continuesRight: e > weekEnd,
      });
    }

    weeks.push({ days, segments: assignLanes(raw) });
  }

  return weeks;
}

/**
 * Packs segments into lanes so two activities on the same days stack vertically
 * rather than overlapping. Longest bars are placed first so they read as
 * continuous rather than being broken up by shorter ones above them.
 */
function assignLanes<T>(segments: Segment<T>[]): LaidOutSegment<T>[] {
  const ordered = [...segments].sort(
    (a, b) => b.span - a.span || a.startCol - b.startCol,
  );

  const lanes: boolean[][] = [];
  const out: LaidOutSegment<T>[] = [];

  for (const seg of ordered) {
    let lane = 0;
    for (;;) {
      lanes[lane] ??= Array(7).fill(false);
      const row = lanes[lane];
      let free = true;
      for (let c = seg.startCol; c < seg.startCol + seg.span; c++) {
        if (row[c]) {
          free = false;
          break;
        }
      }
      if (free) {
        for (let c = seg.startCol; c < seg.startCol + seg.span; c++) row[c] = true;
        break;
      }
      lane++;
    }
    out.push({ ...seg, lane });
  }

  return out.sort((a, b) => a.lane - b.lane || a.startCol - b.startCol);
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Clamps an arbitrary month offset into a valid year/month pair. */
export function normaliseMonth(year: number, month: number) {
  const d = new Date(Date.UTC(year, month, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

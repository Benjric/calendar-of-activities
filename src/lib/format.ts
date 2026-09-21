/**
 * Formatting helpers.
 *
 * Dates are stored as `@db.Date` and come back as UTC midnight. Formatting them
 * with a local timezone would shift a Manila-morning activity back a day, so
 * every formatter here reads the UTC parts explicitly.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export function monthName(monthIndex: number): string {
  return MONTHS[monthIndex] ?? "";
}

/** "10 Aug 2026" */
export function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Collapses a range to its shortest unambiguous form:
 *   same day        -> "10 Aug 2026"
 *   same month      -> "10–12 Aug 2026"
 *   same year       -> "30 Aug – 2 Sep 2026"
 *   spanning years  -> "30 Dec 2026 – 2 Jan 2027"
 */
export function formatDateRange(start: Date, end: Date): string {
  const sameDay =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCDate() === end.getUTCDate();
  if (sameDay) return formatDate(start);

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${MONTHS_SHORT[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${start.getUTCDate()} ${MONTHS_SHORT[start.getUTCMonth()]} – ${end.getUTCDate()} ${MONTHS_SHORT[end.getUTCMonth()]} ${start.getUTCFullYear()}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Inclusive day count. A single-day activity is 1 day, not 0. */
export function dayCount(start: Date, end: Date): number {
  const ms = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
    - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return Math.floor(ms / 86_400_000) + 1;
}

const PESO = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

export function formatPeso(value: unknown): string {
  const n = toNumber(value);
  return n === null ? "—" : PESO.format(n);
}

/** Signed peso, for variance. Always shows the sign so direction is explicit. */
export function formatPesoSigned(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${PESO.format(Math.abs(value))}`;
}

export function formatCount(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(n);
}

export function formatCountSigned(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(Math.abs(value))}`;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(
    typeof value === "object" && value !== null && "toString" in value
      ? (value as { toString(): string }).toString()
      : value,
  );
  return Number.isFinite(parsed) ? parsed : null;
}

/** Builds a UTC date-only value, matching how the DB stores it. */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Parses an <input type="date"> value ("2026-10-05") without timezone drift. */
export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Serialises a Date back to an <input type="date"> value. */
export function toDateInput(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const STATUS_LABEL = {
  PLANNED: "Planned",
  CONDUCTED: "Conducted",
  RESCHEDULED: "Rescheduled",
  DROPPED: "Dropped",
} as const;

export const TYPE_LABEL = {
  LND: "L&D",
  NON_LND: "Non-L&D",
} as const;

export const FUND_LABEL = {
  MOOE: "MOOE",
  HRTD: "HRTD",
  PSF: "PSF",
  OTHER: "Other",
} as const;

/**
 * Role wording. It lives here rather than in `authz.ts` because that module is
 * `server-only` and the accounts screen renders these labels in the browser.
 */
export const ROLE_LABEL = {
  ADMIN: "Administrator",
  PROGRAM_MANAGER: "Program Manager",
  VIEWER: "Viewer",
} as const;

export const ROLE_DESCRIPTION = {
  ADMIN: "Full access, plus account and lookup management.",
  PROGRAM_MANAGER: "Books activities and updates their status.",
  VIEWER: "Reads the Calendar and Catch-up Plan.",
} as const;

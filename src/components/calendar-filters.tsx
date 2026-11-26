"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MARK } from "@/components/status-badge";
import { STATUS_LABEL } from "@/lib/format";

const FILTERABLE = ["PLANNED", "CONDUCTED", "RESCHEDULED"] as const;
type Filterable = (typeof FILTERABLE)[number];

/* Each chip wears its status's tint while switched on, so the row doubles as
   the legend for the grid below it. */
const CHIP_ON: Record<Filterable, string> = {
  PLANNED:
    "border-[var(--status-planned-border)] bg-[var(--status-planned-bg)] text-[var(--status-planned)]",
  CONDUCTED:
    "border-[var(--status-conducted-border)] bg-[var(--status-conducted-bg)] text-[var(--status-conducted)]",
  RESCHEDULED:
    "border-dashed border-[var(--status-rescheduled-border)] bg-[var(--status-rescheduled-bg)] text-[var(--status-rescheduled)]",
};

const CHIP_OFF: Record<Filterable, string> = {
  PLANNED: "border-[var(--status-planned-border)] text-[var(--status-planned)]",
  CONDUCTED: "border-[var(--status-conducted-border)] text-[var(--status-conducted)]",
  RESCHEDULED:
    "border-dashed border-[var(--status-rescheduled-border)] text-[var(--status-rescheduled)]",
};

/**
 * The calendar's filter row.
 *
 * Every control writes to the URL rather than to local state, so a filtered
 * month is a link somebody can send to whoever needs to look at it, and the
 * grid behind it stays a Server Component.
 */
export function CalendarFilters({
  counts,
  hidden,
  divisions,
  divisionId,
}: {
  counts: Record<Filterable, number>;
  hidden: Filterable[];
  divisions: { id: string; name: string; acronym: string | null }[];
  divisionId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const off = new Set(hidden);

  /** Flips one status and drops `sel`, which may point at a hidden bar. */
  function toggleHref(status: Filterable) {
    const next = new Set(off);
    if (next.has(status)) next.delete(status);
    else next.add(status);

    const q = new URLSearchParams(params);
    if (next.size) q.set("hide", [...next].join(","));
    else q.delete("hide");
    q.delete("sel");
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  }

  function onDivision(value: string) {
    const q = new URLSearchParams(params);
    if (value) q.set("div", value);
    else q.delete("div");
    q.delete("sel");
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Show statuses" className="flex flex-wrap gap-2">
        {FILTERABLE.map((s) => {
          const on = !off.has(s);
          return (
            <Link
              key={s}
              href={toggleHref(s)}
              scroll={false}
              role="switch"
              aria-checked={on}
              className={`press inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-[background-color,opacity] duration-200 ${
                on ? CHIP_ON[s] : `bg-card opacity-60 line-through ${CHIP_OFF[s]}`
              }`}
            >
              <span aria-hidden="true" className="font-bold">{MARK[s]}</span>
              {STATUS_LABEL[s]}
              <span className="font-bold tabular-nums">{counts[s]}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5">
        <label htmlFor="div-filter" className="text-sm font-semibold text-[var(--body-muted)]">
          Lead division
        </label>
        <select
          id="div-filter"
          value={divisionId}
          onChange={(e) => onDivision(e.currentTarget.value)}
          className="field-input w-auto min-w-[200px]"
        >
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.acronym ?? d.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

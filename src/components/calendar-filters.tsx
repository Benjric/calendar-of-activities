"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition, type CSSProperties } from "react";

import { STATUS_LABEL } from "@/lib/format";

const FILTERABLE = ["PLANNED", "CONDUCTED", "RESCHEDULED"] as const;
type Filterable = (typeof FILTERABLE)[number];

/* Each chip's colours, handed to the `.status-chip` rules in globals.css. */
const CHIP_VARS: Record<Filterable, CSSProperties> = {
  PLANNED: {
    "--chip-fg": "var(--status-planned)",
    "--chip-bg": "var(--status-planned-bg)",
    "--chip-bd": "var(--status-planned-border)",
    "--chip-solid": "var(--status-planned-solid)",
  } as CSSProperties,
  CONDUCTED: {
    "--chip-fg": "var(--status-conducted)",
    "--chip-bg": "var(--status-conducted-bg)",
    "--chip-bd": "var(--status-conducted-border)",
    "--chip-solid": "var(--status-conducted-solid)",
  } as CSSProperties,
  RESCHEDULED: {
    "--chip-fg": "var(--status-rescheduled)",
    "--chip-bg": "var(--status-rescheduled-bg)",
    "--chip-bd": "var(--status-rescheduled-border)",
    "--chip-solid": "var(--status-rescheduled-solid)",
  } as CSSProperties,
};

/**
 * The calendar's filter row.
 *
 * Every control writes to the URL rather than to local state, so a filtered
 * month is a link somebody can send to whoever needs to look at it, and the
 * grid behind it stays a Server Component. The chips flip optimistically, so
 * they answer the click at once while the grid catches up.
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
  const [pending, startTransition] = useTransition();
  const [shownHidden, setShownHidden] = useOptimistic(hidden);
  const off = new Set(shownHidden);

  /** Flips one status and drops `sel`, which may point at a hidden bar. */
  function toggle(status: Filterable) {
    const next = new Set(off);
    if (next.has(status)) next.delete(status);
    else next.add(status);

    const q = new URLSearchParams(params);
    if (next.size) q.set("hide", [...next].join(","));
    else q.delete("hide");
    q.delete("sel");
    const s = q.toString();

    startTransition(() => {
      setShownHidden([...next]);
      router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
    });
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
      <div
        role="group"
        aria-label="Show statuses"
        aria-busy={pending}
        className="flex flex-wrap items-center gap-2"
      >
        {FILTERABLE.map((s) => {
          const on = !off.has(s);
          return (
            <button
              key={s}
              type="button"
              role="switch"
              aria-checked={on}
              data-dashed={s === "RESCHEDULED"}
              onClick={() => toggle(s)}
              className="status-chip"
              style={CHIP_VARS[s]}
            >
              {/* Keyed by state, so switching on replays the pop and the tick. */}
              <span
                key={on ? "on" : "off"}
                aria-hidden="true"
                className={`chip-check ${on ? "anim-spring" : ""}`}
              >
                {on && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
              {STATUS_LABEL[s]}
              <span className="chip-count">{counts[s]}</span>
            </button>
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
          className="field-input w-auto min-w-[200px] cursor-pointer"
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

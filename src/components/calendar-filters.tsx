"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { STATUS_LABEL } from "@/lib/format";

const FILTERABLE = ["PLANNED", "CONDUCTED", "RESCHEDULED"] as const;
type Filterable = (typeof FILTERABLE)[number];

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
  conflicts,
  dotClass,
}: {
  counts: Record<Filterable, number>;
  hidden: Filterable[];
  divisions: { id: string; name: string; acronym: string | null }[];
  divisionId: string;
  conflicts: number;
  dotClass: Record<string, string>;
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
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="mr-1 text-[13px] font-semibold text-[var(--body-muted)]">
        Show
      </span>

      {FILTERABLE.map((s) => {
        const on = !off.has(s);
        return (
          <Link
            key={s}
            href={toggleHref(s)}
            scroll={false}
            role="switch"
            aria-checked={on}
            className={`flex h-11 items-center gap-2.5 rounded-full py-0 pr-4 pl-3 text-sm transition-colors ${
              on
                ? "border border-input bg-card font-medium text-foreground"
                : "border border-dashed border-input bg-transparent text-muted-foreground"
            }`}
          >
            <span
              aria-hidden="true"
              className={`size-2.5 rounded-full ${dotClass[s]} ${on ? "" : "opacity-40"}`}
            />
            {STATUS_LABEL[s]}
            <span className="font-mono text-[13px] text-muted-foreground tabular-nums">
              {counts[s]}
            </span>
          </Link>
        );
      })}

      <span aria-hidden="true" className="mx-1.5 h-7 w-px bg-border" />

      <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--body-muted)]">
        Lead division
        <select
          value={divisionId}
          onChange={(e) => onDivision(e.currentTarget.value)}
          className="h-11 rounded-[10px] border border-input bg-card px-3 text-sm font-normal text-foreground"
        >
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.acronym ?? d.name}
            </option>
          ))}
        </select>
      </label>

      {conflicts > 0 && (
        <Link
          href="/conflicts"
          className="ml-auto flex h-11 items-center gap-2 rounded-[10px] bg-[var(--conflict-bg)] px-3.5 text-sm font-semibold text-[var(--conflict-text)] transition-colors hover:brightness-97"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true" className="size-4">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          {conflicts} booked over a conflict
        </Link>
      )}
    </div>
  );
}

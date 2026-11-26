"use client";

import { useMemo } from "react";

import { useCombobox } from "@/components/use-combobox";

export interface PersonOption {
  id: string;
  fullName: string;
  position: string | null;
  division: { acronym: string | null } | null;
}

/**
 * Typed focal person with memory.
 *
 * The same shape as the venue and program fields: type a name, pick a
 * suggestion if it is someone already on record, or keep typing — a name that
 * matches nobody is saved on booking and suggested from then on.
 */
export function PersonCombobox({
  id,
  value,
  onChange,
  people,
  className = "",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  people: PersonOption[];
  className?: string;
}) {
  const query = value.trim().replace(/\s+/g, " ").toLowerCase();

  const matches = useMemo(() => {
    if (!query) return people.slice(0, 8);
    // Match from the start of any word first ("cruz" finds "Ana Cruz"), then
    // anywhere, so the likeliest person sits at the top.
    const starts = people.filter((p) =>
      p.fullName.toLowerCase().split(/\s+/).some((w) => w.startsWith(query)) ||
      p.fullName.toLowerCase().startsWith(query),
    );
    const rest = people.filter(
      (p) => !starts.includes(p) && p.fullName.toLowerCase().includes(query),
    );
    return [...starts, ...rest].slice(0, 8);
  }, [people, query]);

  /** Exact (case-insensitive) hit means this person is already on record. */
  const exact = useMemo(
    () => people.find((p) => p.fullName.toLowerCase() === query),
    [people, query],
  );

  const isNew = query.length > 0 && !exact;

  const { listId, open, setOpen, highlight, setHighlight, wrapRef, select, inputProps } =
    useCombobox<PersonOption>({
      matches,
      onSelect: (p) => onChange(p.fullName),
    });

  return (
    <div ref={wrapRef} className="relative">
      <input
        {...inputProps}
        id={id}
        value={value}
        autoComplete="off"
        placeholder="Type a name, e.g. Ana Cruz"
        onChange={(e) => {
          onChange(e.currentTarget.value);
          setOpen(true);
          setHighlight(-1);
        }}
        className={className}
      />

      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="surface-raised anim-open absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto p-1.5"
        >
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(p)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  i === highlight ? "bg-[var(--primary-tint)]" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--avatar-bg)] text-xs font-bold text-[var(--avatar-foreground)]"
                >
                  {p.fullName
                    .split(/\s+/)
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{p.fullName}</span>
                  {p.position && (
                    <span className="block truncate text-xs text-muted-foreground">{p.position}</span>
                  )}
                </span>
                {p.division?.acronym && (
                  <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {p.division.acronym}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isNew && (
        <p className="anim-open mt-1.5 flex items-start gap-1.5 text-[13px] text-muted-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true" className="mt-0.5 size-3.5 shrink-0"><path d="M12 5v14M5 12h14" /></svg>
          <span>
            <span className="font-semibold text-foreground">
              &ldquo;{value.trim()}&rdquo;
            </span>{" "}
            is new. They will be saved on booking and suggested next time.
          </span>
        </p>
      )}
    </div>
  );
}

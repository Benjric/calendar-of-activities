"use client";

import { useMemo } from "react";

import { useCombobox } from "@/components/use-combobox";

export interface ProgramOption {
  id: string;
  name: string;
}

/**
 * Typed program entry with memory.
 *
 * The same shape as the venue field, for the same reason: the office does not
 * keep a program list up front. A name that matches nothing is valid — it is
 * created on save and suggested from then on.
 */
export function ProgramCombobox({
  value,
  onChange,
  programs,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  programs: ProgramOption[];
  className?: string;
}) {
  const query = value.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return programs.slice(0, 8);
    return programs.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 8);
  }, [programs, query]);

  /** Exact (case-insensitive) hit means this is a known program, not a new one. */
  const exact = useMemo(
    () => programs.find((p) => p.name.toLowerCase() === query),
    [programs, query],
  );

  const isNew = query.length > 0 && !exact;

  const { listId, open, setOpen, highlight, setHighlight, wrapRef, select, inputProps } =
    useCombobox<ProgramOption>({
      matches,
      onSelect: (p) => onChange(p.name),
    });

  return (
    <div ref={wrapRef} className="relative">
      <input
        {...inputProps}
        value={value}
        placeholder="Type a program, e.g. Policy Orientation"
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
          className="surface-raised absolute z-20 mt-1 max-h-60 w-full overflow-y-auto p-1"
        >
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(p)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                  i === highlight ? "bg-accent" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {p.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {isNew && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-muted-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true" className="mt-0.5 size-3.5 shrink-0"><path d="M12 5v14M5 12h14" /></svg>
          <span>
            <span className="font-medium text-foreground">
              &ldquo;{value.trim()}&rdquo;
            </span>{" "}
            is new. It will be saved on booking and suggested next time.
          </span>
        </p>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";

import { useCombobox } from "@/components/use-combobox";

export interface VenueOption {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  isBookable: boolean;
}

/**
 * Typed venue entry with memory.
 *
 * The office does not maintain a venue list up front — it types a hall name,
 * and that name becomes a suggestion from then on. So this is a free text input
 * whose suggestions come from venues already used, not a closed dropdown.
 *
 * A name that matches nothing is valid: it is created on save.
 */
export function VenueCombobox({
  value,
  onChange,
  venues,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  venues: VenueOption[];
  className?: string;
}) {
  const query = value.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return venues.slice(0, 8);
    return venues
      .filter((v) => v.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [venues, query]);

  /** Exact (case-insensitive) hit means this is a known venue, not a new one. */
  const exact = useMemo(
    () => venues.find((v) => v.name.toLowerCase() === query),
    [venues, query],
  );

  const isNew = query.length > 0 && !exact;

  const { listId, open, setOpen, highlight, setHighlight, wrapRef, select, inputProps } =
    useCombobox<VenueOption>({
      matches,
      onSelect: (v) => onChange(v.name),
    });

  return (
    <div ref={wrapRef} className="relative">
      <input
        {...inputProps}
        value={value}
        placeholder="Type a venue, e.g. Main Training Hall"
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
          {matches.map((v, i) => (
            <li key={v.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(v)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                  i === highlight ? "bg-accent" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{v.name}</span>
                  {(v.location || v.capacity) && (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[v.location, v.capacity ? `${v.capacity} pax` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                {!v.isBookable && (
                  <span className="shrink-0 rounded border border-[var(--grid-line)] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    not checked
                  </span>
                )}
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

      {exact && !exact.isBookable && (
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          This venue is not conflict-checked, so it never collides.
        </p>
      )}
    </div>
  );
}

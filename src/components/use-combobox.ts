"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * The interaction half of a "type a name, or pick one you used before" field.
 *
 * Venues and programs behave identically here — open on focus, arrow through
 * the suggestions, Enter to take the highlighted one, Escape or a click
 * outside to dismiss — while rendering different rows. This hook owns the
 * behaviour so each component only has to own its markup.
 */
export function useCombobox<T>({
  matches,
  onSelect,
}: {
  matches: T[];
  onSelect: (item: T) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function close() {
    setOpen(false);
    setHighlight(-1);
  }

  function select(item: T) {
    onSelect(item);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(matches.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(-1, h - 1));
    } else if (e.key === "Enter") {
      // Only swallow Enter when it is actually choosing something, so it still
      // submits the step when no suggestion is highlighted.
      if (open && highlight >= 0 && matches[highlight]) {
        e.preventDefault();
        select(matches[highlight]);
      }
    } else if (e.key === "Escape") {
      close();
    }
  }

  /** Props every one of these inputs needs, so no component forgets the ARIA. */
  const inputProps = {
    type: "text" as const,
    role: "combobox" as const,
    "aria-expanded": open,
    "aria-controls": listId,
    "aria-autocomplete": "list" as const,
    autoComplete: "off",
    onFocus: () => setOpen(true),
    onKeyDown,
  };

  return { listId, open, setOpen, highlight, setHighlight, wrapRef, select, inputProps };
}

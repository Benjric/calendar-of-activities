"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export function UserMenu({
  name,
  email,
  roleLabel,
}: {
  name: string;
  email: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${name}`}
        className="press grid size-11 place-items-center rounded-full border border-border bg-[var(--avatar-bg)] text-sm font-bold text-[var(--avatar-foreground)] transition-[box-shadow,transform] hover:shadow-[0_0_0_3px_var(--avatar-bg)]"
      >
        {initials || "?"}
      </button>

      {open && (
        <div
          role="menu"
          className="surface-raised anim-open absolute right-0 z-40 mt-2 w-60 origin-top-right p-1.5"
        >
          <div className="border-b border-[var(--grid-line)] px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <p className="mt-1.5 inline-block rounded-md border border-border bg-[var(--subtle)] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {roleLabel}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
            className="mt-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

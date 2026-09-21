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
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
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
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent"
      >
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold"
        >
          {initials || "?"}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[13px] font-medium">{name}</span>
          <span className="block text-[11px] text-muted-foreground">
            {roleLabel}
          </span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="surface-raised absolute right-0 z-40 mt-1.5 w-56 p-1"
        >
          <div className="border-b border-[var(--grid-line)] px-3 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{email}</p>
            <p className="mt-1 inline-block rounded border border-[var(--grid-line)] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {roleLabel}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
            className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

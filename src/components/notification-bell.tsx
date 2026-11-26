"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { markNotificationsSeen } from "@/lib/notification-actions";

export interface BellItem {
  id: string;
  title: string;
  dates: string;
  when: string;
  by: string | null;
  unread: boolean;
}

/**
 * The header bell: activities other people booked recently. Opening the panel
 * marks them read; the dots stay on what was new until the panel closes, so
 * the reader can still see which ones they had not seen.
 *
 * The header keys this component by its data, so fresh counts from the server
 * remount it rather than being copied into state.
 */
export function NotificationBell({
  items,
  unread,
}: {
  items: BellItem[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread);
  const [newIds, setNewIds] = useState(() => new Set(items.filter((i) => i.unread).map((i) => i.id)));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  });

  function close() {
    if (!open) return;
    setOpen(false);
    setNewIds(new Set());
  }

  function toggle() {
    if (open) return close();
    setOpen(true);
    if (count > 0) {
      setCount(0);
      void markNotificationsSeen();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `Notifications, ${count} new` : "Notifications"}
        className="press relative grid size-11 place-items-center rounded-full border border-border bg-card text-[var(--body-muted)] transition-colors hover:bg-accent hover:text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`size-5 ${count > 0 ? "bell-ring" : ""}`}
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && (
          <span
            key={count}
            aria-hidden="true"
            className="anim-spring absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-card bg-[var(--conflict)] px-1 text-[11px] font-bold text-white tabular-nums"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="surface-raised anim-open absolute right-0 z-40 mt-2 w-[min(380px,calc(100vw-32px))] origin-top-right overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-[var(--grid-line)] px-4 py-3">
            <span className="eyebrow">Newly booked</span>
            <span className="text-xs text-muted-foreground">Last 30 days</span>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-6 py-8 text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--meter-target)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-7">
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <strong className="text-sm">Nothing new</strong>
              <span className="text-[13px] text-muted-foreground">
                Activities other people book will appear here.
              </span>
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-[var(--grid-line)] overflow-y-auto">
              {items.map((n, i) => {
                const isNew = newIds.has(n.id);
                return (
                  <li
                    key={n.id}
                    className="anim-up"
                    style={{ animationDelay: `${Math.min(i * 0.03, 0.3).toFixed(2)}s` }}
                  >
                    <Link
                      href={`/activities/${n.id}`}
                      onClick={close}
                      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--header-bg)] ${isNew ? "bg-[var(--primary-tint)]" : ""}`}
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--status-planned-bg)] text-[var(--status-planned)]"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                          <rect x="3" y="5" width="18" height="16" rx="2" />
                          <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug">
                          <strong>{n.by ?? "Someone"}</strong> booked{" "}
                          <strong className="text-primary">{n.title}</strong>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                          {n.dates} · {n.when}
                        </span>
                      </span>
                      {isNew && (
                        <span aria-label="New" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

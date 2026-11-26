"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { restoreActivity } from "@/lib/actions";

export interface ArchiveItem {
  id: string;
  title: string;
  type: string;
  dropped: string | null;
  where: string;
  reason: string | null;
  by: string | null;
}

/**
 * The archive's searchable list. Restoring puts the activity back on the
 * calendar as Planned; a toast confirms it, and the card leaves the list once
 * the server has re-rendered.
 */
export function ArchiveList({
  items,
  canRestore,
}: {
  items: ArchiveItem[];
  canRestore: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; n: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The toast fades itself out; this also clears it when reduced motion has
  // switched the animation (and so its end event) off.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3300);
    return () => clearTimeout(t);
  }, [toast]);

  const query = q.trim().toLowerCase();
  const shown = query
    ? items.filter((a) =>
        [a.title, a.where, a.reason ?? ""].join(" ").toLowerCase().includes(query),
      )
    : items;

  function restore(a: ArchiveItem) {
    setError(null);
    setBusyId(a.id);
    startTransition(async () => {
      const r = await restoreActivity(a.id);
      setBusyId(null);
      if (r.ok) {
        // `n` re-keys the toast, so restoring twice in a row replays it.
        setToast((t) => ({ title: a.title, n: (t?.n ?? 0) + 1 }));
        router.refresh();
      } else {
        setError(`${a.title} could not be restored. Try again from its own page.`);
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-[15px] text-muted-foreground">
          {items.length} dropped {items.length === 1 ? "activity" : "activities"}
        </span>
        <label className="field-shell flex h-[46px] min-w-[300px] items-center gap-2 rounded-[10px] border border-[var(--input)] bg-card px-3.5">
          <span className="sr-only">Search the archive</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-[17px] text-muted-foreground">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Search dropped activities"
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="anim-alert rounded-xl border border-[var(--conflict-border)] bg-[var(--conflict-bg)] px-4 py-3 text-[15px] text-[var(--conflict-text)]">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="anim-up flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[var(--input)] bg-card px-6 py-12 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--status-dropped-solid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-8">
            <path d="M3 7h18v13H3z" />
            <path d="M1 3h22v4H1zM10 12h4" />
          </svg>
          <strong className="text-base">{items.length === 0 ? "Archive is empty" : "No matches"}</strong>
          <span className="text-[15px] text-muted-foreground">
            {items.length === 0
              ? "Nothing has been dropped."
              : `No dropped activity matches “${q}”.`}
          </span>
        </div>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {shown.map((a, i) => (
            <li
              key={a.id}
              className="surface lift anim-up flex flex-col gap-3 px-[22px] py-5 hover:border-[var(--status-dropped-border)]"
              style={{ animationDelay: `${Math.min(0.1 + i * 0.08, 0.6).toFixed(2)}s` }}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href={`/activities/${a.id}`}
                  className="font-heading text-lg font-semibold text-[var(--body-muted)] line-through decoration-[#a9a08b] hover:text-primary"
                >
                  {a.title}
                </Link>
                <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[var(--status-dropped-border)] bg-[var(--status-dropped-bg)] px-2.5 text-[13px] font-bold text-[var(--status-dropped)]">
                  <span aria-hidden="true">×</span>Dropped
                </span>
                <span className="inline-flex h-6 items-center rounded-md border border-border px-2 text-[13px] text-muted-foreground">
                  {a.type}
                </span>
                {a.dropped && (
                  <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                    Dropped {a.dropped}
                  </span>
                )}
              </div>
              <span className="text-[15px] text-muted-foreground tabular-nums">{a.where}</span>
              {a.reason && (
                <div className="rounded-[10px] bg-[var(--status-dropped-wash)] px-3.5 py-3 text-[15px] leading-normal text-[var(--body-muted)]">
                  <strong className="text-foreground">Reason:</strong> {a.reason}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <span className="text-sm text-muted-foreground">
                  {a.by ? `Dropped by ${a.by}` : "Dropped by an unrecorded user"}
                </span>
                {canRestore && (
                  <button
                    type="button"
                    onClick={() => restore(a)}
                    disabled={pending}
                    className="press inline-flex min-h-[42px] items-center gap-2 rounded-[10px] border border-primary bg-card px-4 text-[15px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-55"
                  >
                    {busyId === a.id ? (
                      <span aria-hidden="true" className="anim-spin size-4 rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
                        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    )}
                    {busyId === a.id ? "Restoring…" : "Restore to calendar"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {toast && (
        <div
          key={toast.n}
          role="status"
          className="anim-toast fixed bottom-7 left-1/2 z-50 flex w-[min(380px,calc(100vw-32px))] -translate-x-1/2 items-center gap-2.5 rounded-xl bg-[#0f172a] px-[18px] py-3.5 text-[15px] text-white shadow-[0_16px_32px_-16px_rgb(15_23_42/0.6)]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[18px] shrink-0">
            <path d="M5 12l5 5 9-10" />
          </svg>
          <span>
            <strong>{toast.title}</strong> is back on the calendar as Planned.
          </span>
        </div>
      )}
    </>
  );
}

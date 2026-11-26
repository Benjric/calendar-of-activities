"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Confirms a booking the moment the new activity's page opens. The booking
 * form lands here with `?booked=1`; the flag is stripped straight away so a
 * reload or a shared link does not announce the booking again.
 */
export function BookedToast({ title, conflicts }: { title: string; conflicts: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [show] = useState(() => params.get("booked") === "1");
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;
    router.replace(pathname, { scroll: false });
    const t = setTimeout(() => setVisible(false), 4200);
    return () => clearTimeout(t);
  }, [show, router, pathname]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="anim-toast fixed bottom-7 left-1/2 z-50 flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 items-start gap-3 rounded-xl bg-[#0f172a] px-[18px] py-3.5 text-[15px] text-white shadow-[0_16px_32px_-16px_rgb(15_23_42/0.6)]"
      style={{ animationDuration: "4.2s" }}
    >
      <span aria-hidden="true" className="anim-spring mt-px grid size-6 shrink-0 place-items-center rounded-full bg-[#22c55e] text-[#0f172a]" style={{ animationDelay: "0.2s" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="leading-snug">
        <strong>{title}</strong> is booked and on the calendar.
        {conflicts > 0 && (
          <span className="mt-0.5 block text-sm text-white/70">
            {conflicts === 1 ? "1 conflict was" : `${conflicts} conflicts were`} continued past and recorded.
          </span>
        )}
        <span className="mt-0.5 block text-sm text-white/70">Everyone else sees it under the bell.</span>
      </span>
    </div>
  );
}

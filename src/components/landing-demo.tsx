"use client";

import { useState } from "react";

const TABS = [
  { key: "book", label: "Book" },
  { key: "conduct", label: "Conduct" },
  { key: "resched", label: "Reschedule" },
] as const;

type Tab = (typeof TABS)[number]["key"];

/**
 * The landing page's "see it in action" card: three moments from an
 * activity's life. Every figure and title in it is an example, and says so.
 */
export function LandingDemo() {
  const [tab, setTab] = useState<Tab>("book");

  return (
    <div className="anim-float">
      <div className="surface-raised overflow-hidden">
        <div
          role="tablist"
          aria-label="See it in action"
          className="flex gap-1 border-b border-[var(--meter-track)] bg-[var(--weekend-bg)] p-2"
        >
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`demo-tab-${t.key}`}
                aria-selected={on}
                aria-controls="demo-panel"
                onClick={() => setTab(t.key)}
                className={`min-h-11 flex-1 rounded-[10px] text-[15px] font-semibold transition-[background-color,color,box-shadow] duration-200 ${
                  on
                    ? "bg-card text-primary shadow-[0_1px_2px_rgb(15_23_42/0.08),0_0_0_1px_var(--border)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div
          id="demo-panel"
          role="tabpanel"
          aria-labelledby={`demo-tab-${tab}`}
          className="min-h-[330px] p-[22px]"
        >
          {/* Keyed by tab, so each switch plays the panel's entrance again. */}
          <div key={tab} className="anim-pop">
            {tab === "book" && (
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-[var(--body-muted)]">Venue</span>
                  <span className="flex h-11 items-center justify-between rounded-[10px] border-[1.5px] border-primary px-3 text-[15px] font-semibold">
                    Training Hall
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 text-muted-foreground"><path d="M6 9l6 6 6-6" /></svg>
                  </span>
                </div>
                <div className="anim-shake flex gap-3 rounded-xl border border-[var(--conflict-border)] bg-[var(--conflict-bg)] px-4 py-3.5 text-[var(--conflict-text)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px size-5 shrink-0"><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.01" /></svg>
                  <div className="flex flex-col gap-2">
                    <strong className="text-[15px]">Booked by another activity on Nov 25</strong>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex min-h-9 items-center rounded-lg border border-[var(--conflict-border)] bg-card px-3 text-sm font-semibold">Choose another</span>
                      <span className="inline-flex min-h-9 items-center rounded-lg bg-[var(--conflict)] px-3 text-sm font-semibold text-white">Continue anyway</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs text-[var(--faint-foreground)]">Example booking</span>
              </div>
            )}

            {tab === "conduct" && (
              <div className="flex flex-col gap-4">
                <DemoMeter label="Physical" pill="Gain · +12" tone="gain" width="100%" caption="92 of 80 trained" delay="0.2s" />
                <DemoMeter label="Financial" pill="Gap · −₱11,500" tone="gap" width="92%" caption="₱138,500 of ₱150,000 spent" delay="0.35s" />
                <span className="text-xs text-[var(--faint-foreground)]">Example figures</span>
              </div>
            )}

            {tab === "resched" && (
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-2.5 rounded-xl border border-dashed border-[var(--status-rescheduled-border)] bg-[var(--status-rescheduled-wash)] px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2.5">
                    <strong className="text-[15px]">Capacity Building on Assessment</strong>
                    <span className="text-[13px] font-bold text-[var(--status-rescheduled)]">
                      <span aria-hidden="true">→ </span>Rescheduled
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className="text-[var(--faint-foreground)] line-through">Nov 12–13</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--status-rescheduled-solid)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    <strong>Dec 3–4</strong>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2.5 rounded-xl border border-border px-4 py-3">
                  <span className="text-[15px] font-semibold text-[var(--status-dropped)] line-through">Records Clean-up Drive</span>
                  <span className="text-[13px] font-bold text-[var(--status-dropped)]">
                    <span aria-hidden="true">× </span>Archived
                  </span>
                </div>
                <span className="text-xs text-[var(--faint-foreground)]">Example activities</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoMeter({
  label,
  pill,
  tone,
  width,
  caption,
  delay,
}: {
  label: string;
  pill: string;
  tone: "gain" | "gap";
  width: string;
  caption: string;
  delay: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <strong className="text-[15px]">{label}</strong>
        <span
          className={`anim-spring rounded-full border px-2.5 py-0.5 text-[13px] font-bold ${
            tone === "gain"
              ? "border-[var(--gain-border)] bg-[var(--gain-bg)] text-[var(--gain)]"
              : "border-[var(--gap-border)] bg-[var(--gap-bg)] text-[var(--gap)]"
          }`}
          style={{ animationDelay: "0.6s" }}
        >
          {pill}
        </span>
      </div>
      <span className="h-2.5 overflow-hidden rounded-full bg-[var(--meter-track)]">
        <span
          className={`anim-grow block h-full rounded-full ${tone === "gain" ? "bg-[var(--gain-solid)]" : "bg-[var(--gap-solid)]"}`}
          style={{ width, animationDelay: delay }}
        />
      </span>
      <span className="text-[13px] text-muted-foreground">{caption}</span>
    </div>
  );
}

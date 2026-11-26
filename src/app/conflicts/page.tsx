import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { requireManagerPage } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { formatDate, formatDateRange } from "@/lib/format";

export const dynamic = "force-dynamic";

const KIND_LABEL = {
  DATE: "Date",
  VENUE: "Venue",
  PARTICIPANT: "Participant",
} as const;

type Kind = keyof typeof KIND_LABEL;
const KINDS: (Kind | "ALL")[] = ["ALL", "DATE", "VENUE", "PARTICIPANT"];

/**
 * Every conflict someone knowingly booked over.
 *
 * The spec lets all three checks be waved through, which is correct — but
 * without this page the decision is made and then forgotten. This is the answer
 * to "who approved this double-booking?" months later.
 *
 * The kind filter lives in the URL (`?kind=venue`), so a filtered list is a
 * link, and the page stays a Server Component.
 */
export default async function ConflictsPage({ searchParams }: PageProps<"/conflicts">) {
  await requireManagerPage();
  const params = await searchParams;
  const rawKind = typeof params.kind === "string" ? params.kind.toUpperCase() : "ALL";
  const kind = (KINDS as string[]).includes(rawKind) ? (rawKind as Kind | "ALL") : "ALL";

  const overrides = await prisma.conflictOverride.findMany({
    include: {
      activity: {
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          status: true,
          archivedAt: true,
          venue: { select: { name: true } },
          leadDivision: { select: { acronym: true, name: true } },
        },
      },
      overriddenBy: { select: { name: true, email: true } },
    },
    orderBy: { overriddenAt: "desc" },
  });

  const active = overrides.filter((o) => o.activity.archivedAt === null);
  const shown = kind === "ALL" ? active : active.filter((o) => o.kind === kind);

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const upcoming = active
    .map((o) => o.activity.startDate)
    .filter((d) => d >= todayUTC)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const stats = [
    { label: "On the active calendar", value: String(active.length) },
    {
      label: "Still Planned",
      value: String(active.filter((o) => o.activity.status === "PLANNED").length),
    },
    {
      label: "Next one starts",
      value: upcoming
        ? upcoming.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
        : "—",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-[22px]">
      <div className="anim-up flex flex-col gap-2.5">
        <h1 className="text-[32px] leading-tight sm:text-[36px]">Accepted conflicts</h1>
        <p className="max-w-[760px] text-[17px] leading-relaxed text-[var(--body-muted)]">
          Bookings made over a date, venue or participant collision that someone
          chose to continue past. The system never blocks these. It records
          them, so the decision survives the meeting it was made in.
        </p>
      </div>

      <div
        className="anim-up grid gap-3 sm:grid-cols-3"
        style={{ animationDelay: "0.05s" }}
      >
        {stats.map((s) => (
          <div key={s.label} className="surface flex flex-col gap-1 px-[18px] py-4">
            <span className="text-sm text-muted-foreground">{s.label}</span>
            <strong className="figure text-[28px] font-semibold">{s.value}</strong>
          </div>
        ))}
      </div>

      <div
        role="group"
        aria-label="Filter by kind"
        className="anim-up flex flex-wrap gap-1.5 self-start rounded-xl bg-[#e9edf3] p-1 dark:bg-[var(--subtle)]"
        style={{ animationDelay: "0.1s" }}
      >
        {KINDS.map((k) => {
          const on = kind === k;
          const count = k === "ALL" ? active.length : active.filter((o) => o.kind === k).length;
          return (
            <Link
              key={k}
              href={k === "ALL" ? "/conflicts" : `/conflicts?kind=${k.toLowerCase()}`}
              scroll={false}
              aria-pressed={on}
              className={`press flex min-h-10 items-center gap-1.5 rounded-[9px] px-3.5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 ${
                on
                  ? "bg-card text-foreground shadow-[0_1px_2px_rgb(15_23_42/0.08)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k === "ALL" ? "All" : KIND_LABEL[k]}
              <span className="font-bold tabular-nums">{count}</span>
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div
          key={kind}
          className="anim-up flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[var(--input)] bg-card px-6 py-12 text-center"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--status-conducted-solid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-8">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12l3 3 5-6" />
          </svg>
          <strong className="text-base">
            No accepted {kind === "ALL" ? "" : `${KIND_LABEL[kind].toLowerCase()} `}conflicts
          </strong>
          <span className="text-[15px] text-muted-foreground">
            Nothing on the active calendar was booked over this kind of collision.
          </span>
        </div>
      ) : (
        <ul key={kind} className="flex flex-col gap-3.5">
          {shown.map((o, i) => {
            const a = o.activity;
            const who = o.overriddenBy?.name ?? o.overriddenBy?.email ?? null;
            const canReschedule = a.status === "PLANNED" || a.status === "RESCHEDULED";
            return (
              <li
                key={o.id}
                className="surface lift anim-up flex flex-col gap-3.5 px-[22px] py-5 hover:border-[var(--conflict-border)]"
                style={{ animationDelay: `${Math.min(0.15 + i * 0.06, 0.6).toFixed(2)}s` }}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex h-[26px] items-center gap-1.5 rounded-[7px] border border-[var(--conflict-border)] bg-[var(--conflict-bg)] px-2.5 text-[13px] font-bold text-[var(--conflict-text)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[13px]"><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.01" /></svg>
                    {KIND_LABEL[o.kind]} conflict
                  </span>
                  <Link
                    href={`/activities/${a.id}`}
                    className="font-heading text-lg font-semibold hover:text-primary"
                  >
                    {a.title}
                  </Link>
                  <StatusBadge status={a.status} />
                  <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                    Accepted {formatDate(o.overriddenAt)}
                  </span>
                </div>

                <span className="text-[15px] text-[var(--body-muted)] tabular-nums">
                  {[
                    formatDateRange(a.startDate, a.endDate),
                    a.venue?.name,
                    a.leadDivision?.acronym ?? a.leadDivision?.name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>

                <div className="flex flex-wrap items-stretch gap-2.5">
                  <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5 rounded-xl border border-border px-3.5 py-3">
                    <span className="eyebrow">This booking</span>
                    <strong className="text-[15px]">{a.title}</strong>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatDateRange(a.startDate, a.endDate)}
                      {a.venue && ` · ${a.venue.name}`}
                    </span>
                  </div>
                  <div aria-hidden="true" className="flex items-center text-[var(--conflict)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-7"><path d="M7 7l10 10M17 7L7 17" /></svg>
                  </div>
                  <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5 rounded-xl border border-[var(--conflict-border)] bg-[var(--conflict-wash)] px-3.5 py-3">
                    <span className="eyebrow text-[var(--conflict-text)]">Collided with</span>
                    <span className="text-[15px] leading-normal">{o.details}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--meter-track)] pt-3">
                  <span className="inline-flex items-center gap-2 text-sm text-[var(--body-muted)]">
                    <span
                      aria-hidden="true"
                      className="grid size-[26px] place-items-center rounded-full bg-[var(--avatar-bg)] text-xs font-bold text-[var(--avatar-foreground)]"
                    >
                      {who ? who.charAt(0).toUpperCase() : "?"}
                    </span>
                    {who
                      ? `Accepted by ${who}`
                      : "Accepted before sign-in was enabled — no user recorded."}
                  </span>
                  <div className="flex gap-2">
                    <Link href={`/activities/${a.id}`} className="btn-ghost min-h-10 px-3.5 text-sm">
                      Open activity
                    </Link>
                    {canReschedule && (
                      <Link href={`/activities/${a.id}#status-actions`} className="btn-ghost min-h-10 px-3.5 text-sm">
                        Reschedule
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

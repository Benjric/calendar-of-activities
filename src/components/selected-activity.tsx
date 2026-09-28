import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { dayCount, formatDate, formatDateRange } from "@/lib/format";
import type { ActivityListItem } from "@/lib/queries";

/**
 * The rail's detail panel for whichever bar is selected on the grid.
 *
 * It deliberately stops short of the full record: enough to decide whether
 * this is the activity you were looking for, and a way through to the rest.
 * Answering "which one is that?" should not cost a page load.
 */
export function SelectedActivity({
  activity,
  overdue,
}: {
  activity: ActivityListItem;
  overdue: boolean;
}) {
  const days = dayCount(activity.startDate, activity.endDate);

  const facts = [
    {
      label: "Dates",
      value: `${formatDateRange(activity.startDate, activity.endDate)}${days > 1 ? ` · ${days} days` : ""}`,
      strong: true,
    },
    { label: "Venue", value: activity.venue?.name ?? "—" },
    { label: "Lead division", value: activity.leadDivision?.name ?? "—" },
    { label: "Focal person", value: activity.focalPerson?.fullName ?? "—" },
    {
      label: "Staff committed",
      value: String(activity._count.participants),
      mono: true,
    },
  ];

  return (
    <section
      aria-label="Selected activity"
      className="surface flex flex-col gap-3.5 p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Selected</span>
        <StatusBadge status={activity.status} />
      </div>

      <h2 className="font-heading text-[26px] leading-tight">
        {activity.title}
      </h2>

      <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd
              className={`m-0 ${f.strong ? "font-semibold" : ""} ${f.mono ? "font-mono tabular-nums" : ""}`}
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      {overdue && (
        <div className="flex flex-col gap-2.5 rounded-lg bg-[var(--status-planned-bg)] p-3 text-[13px] leading-relaxed text-[var(--status-planned)]">
          <span>
            <strong>Ended {formatDate(activity.endDate)} with no status recorded.</strong>{" "}
            Mark it Conducted, Rescheduled or Dropped so the report stays true.
          </span>
          <Link
            href={`/activities/${activity.id}`}
            className="inline-flex h-11 items-center self-start rounded-[9px] bg-[var(--status-planned-solid)] px-3.5 text-sm font-semibold text-white transition-colors hover:brightness-95"
          >
            Update status
          </Link>
        </div>
      )}

      {activity._count.conflictOverrides > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-[var(--conflict-bg)] p-3 text-[13px] leading-relaxed">
          <span className="font-bold text-[var(--conflict-text)]">
            Booked over {activity._count.conflictOverrides}{" "}
            {activity._count.conflictOverrides === 1 ? "conflict" : "conflicts"}
          </span>
          <span className="text-muted-foreground">
            The full record shows what each one collided with, and who
            continued anyway.
          </span>
        </div>
      )}

      <Link
        href={`/activities/${activity.id}`}
        className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-input text-sm font-semibold transition-colors hover:bg-accent"
      >
        Open the full record
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </section>
  );
}

import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { dayCount, formatDate, formatDateRange, FUND_LABEL, TYPE_LABEL } from "@/lib/format";
import type { ActivityListItem } from "@/lib/queries";

/**
 * The rail's detail panel for whichever bar is selected on the grid.
 *
 * It deliberately stops short of the full record: enough to decide whether
 * this is the activity you were looking for, and a way through to the rest.
 * The calendar keys it by activity id, so picking another bar remounts it and
 * the panel slides in fresh instead of silently changing its words.
 */
export function SelectedActivity({
  activity,
  overdue,
  canManage,
}: {
  activity: ActivityListItem;
  overdue: boolean;
  canManage: boolean;
}) {
  const days = dayCount(activity.startDate, activity.endDate);
  const conflicts = activity._count.conflictOverrides;

  const fund = !activity.hasFinancialReq
    ? "—"
    : activity.sourceOfFund
      ? FUND_LABEL[activity.sourceOfFund]
      : "—";

  const facts = [
    { label: "Venue", value: activity.venue?.name ?? "—" },
    { label: "Lead Division", value: activity.leadDivision?.name ?? "—" },
    { label: "Focal Person", value: activity.focalPerson?.fullName ?? "—" },
    { label: "Type", value: TYPE_LABEL[activity.type] },
    { label: "Source of Fund", value: fund },
    {
      label: "Participants",
      value:
        activity.participantCount !== null
          ? String(activity.participantCount)
          : activity._count.participants
            ? `${activity._count.participants} named`
            : "—",
    },
  ];

  const href = `/activities/${activity.id}`;
  const cta =
    activity.status === "CONDUCTED"
      ? "View accomplishment"
      : activity.status === "PLANNED" && canManage
        ? "Update status"
        : null;

  return (
    <section
      aria-label="Selected activity"
      aria-live="polite"
      className="surface anim-swap flex flex-col gap-3.5 px-5 py-[18px]"
    >
      <div className="flex items-start justify-between gap-2.5">
        <span className="eyebrow">Selected activity</span>
        <StatusBadge status={activity.status} />
      </div>

      <h2 className="text-[21px] leading-tight">{activity.title}</h2>
      <span className="text-[15px] text-[var(--body-muted)] tabular-nums">
        {formatDateRange(activity.startDate, activity.endDate)} · {days}{" "}
        {days === 1 ? "day" : "days"}
      </span>

      {conflicts > 0 && (
        <div className="anim-pop flex gap-2.5 rounded-xl border border-[var(--conflict-border)] bg-[var(--conflict-bg)] px-3.5 py-3 text-sm leading-relaxed text-[var(--conflict-text)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px size-[18px] shrink-0">
            <path d="M12 3l10 18H2z" />
            <path d="M12 10v4M12 17.5v.01" />
          </svg>
          <span>
            <strong>
              Booked over {conflicts === 1 ? "a recorded conflict" : `${conflicts} recorded conflicts`}.
            </strong>{" "}
            The full record shows what each one collided with, and who continued anyway.
          </span>
        </div>
      )}

      {overdue && (
        <div className="anim-pop rounded-xl border border-[#e8c48f] bg-[var(--status-rescheduled-bg)] px-3.5 py-3 text-sm leading-relaxed text-[var(--status-rescheduled)]">
          <strong>Awaiting a status.</strong> This activity ended{" "}
          {formatDate(activity.endDate)} but is still Planned.
        </div>
      )}

      <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="m-0 font-semibold">{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        {cta && (
          <Link href={href} className="btn-primary">
            {cta}
          </Link>
        )}
        <Link href={href} className="btn-ghost nudge">
          Open record
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="arr size-4">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

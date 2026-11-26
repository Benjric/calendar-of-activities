import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentList } from "@/components/attachment-list";
import { BookedToast } from "@/components/booked-toast";
import { StatusActions } from "@/components/status-actions";
import { StatusBadge } from "@/components/status-badge";
import { NarrativeBlock, VarianceReadout } from "@/components/variance-readout";
import {
  dayCount,
  formatDate,
  formatDateRange,
  FUND_LABEL,
  STATUS_LABEL,
  toDateInput,
  TYPE_LABEL,
} from "@/lib/format";
import { canManageActivities, requireUser } from "@/lib/authz";
import { getActivity } from "@/lib/queries";
import { computeActivityVariance } from "@/lib/variance";

export const dynamic = "force-dynamic";

const CONFLICT_KIND_LABEL = {
  DATE: "Date",
  VENUE: "Venue",
  PARTICIPANT: "Participant",
} as const;

/** Filled dot for each step on the history thread. */
const STATUS_DOT = {
  PLANNED: "bg-[var(--status-planned-solid)]",
  CONDUCTED: "bg-[var(--status-conducted-solid)]",
  RESCHEDULED: "bg-[var(--status-rescheduled-solid)]",
  DROPPED: "bg-[var(--status-dropped-solid)]",
} as const;

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return typeof v === "object" && "toString" in v
    ? (v as { toString(): string }).toString()
    : String(v);
}

export default async function ActivityPage({
  params,
}: PageProps<"/activities/[id]">) {
  const user = await requireUser();
  const canManage = canManageActivities(user.role);
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) notFound();

  const variance = computeActivityVariance(activity);
  const days = dayCount(activity.startDate, activity.endDate);

  const fund = activity.hasFinancialReq
    ? activity.sourceOfFund === "OTHER"
      ? activity.sourceOfFundOther ?? "Other"
      : activity.sourceOfFund
        ? FUND_LABEL[activity.sourceOfFund]
        : "—"
    : "No financial requirement";

  const facts = [
    { label: "Dates", value: `${formatDateRange(activity.startDate, activity.endDate)} · ${days} ${days === 1 ? "day" : "days"}` },
    { label: "Venue", value: activity.venue?.name ?? "—" },
    { label: "Type", value: TYPE_LABEL[activity.type] },
    { label: "Lead Division", value: activity.leadDivision?.name ?? "—" },
    { label: "Focal Person", value: activity.focalPerson?.fullName ?? "—" },
    { label: "Program", value: activity.program?.name ?? "—" },
    { label: "Performance Indicator", value: activity.performanceIndicator ?? "—" },
    { label: "Source of Fund", value: fund },
  ];

  const details = (
    <section className="surface flex flex-col gap-3 px-5 py-[18px]">
      <h2 className="eyebrow font-sans">Activity details</h2>
      <dl className="m-0 grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="m-0 font-semibold tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
      <BookedToast title={activity.title} conflicts={activity.conflictOverrides.length} />
      <div className="anim-up flex flex-col gap-2">
        <Link
          href="/calendar"
          className="self-start text-sm font-semibold text-primary hover:text-[var(--primary-hover)]"
        >
          ← Back to calendar
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={activity.status} />
          {activity.archivedAt && (
            <span className="text-sm text-muted-foreground">
              Archived {formatDate(activity.archivedAt)}
            </span>
          )}
        </div>
        <h1 className="text-[28px] leading-tight sm:text-[32px]">{activity.title}</h1>
        <span className="text-base text-[var(--body-muted)] tabular-nums">
          {[
            formatDateRange(activity.startDate, activity.endDate),
            activity.venue?.name,
            activity.leadDivision?.acronym ?? activity.leadDivision?.name,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      {canManage && activity.conflictOverrides.length > 0 && (
        <div
          className="anim-pop rounded-2xl border border-[var(--conflict-border)] bg-[var(--conflict-bg)] px-5 py-4"
          style={{ animationDelay: "0.05s" }}
        >
          <h2 className="flex items-center gap-2 font-sans text-base font-bold text-[var(--conflict-text)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5"><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.01" /></svg>
            Booked over {activity.conflictOverrides.length}{" "}
            {activity.conflictOverrides.length === 1 ? "conflict" : "conflicts"}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {activity.conflictOverrides.map((o) => (
              <li key={o.id} className="rounded-xl border border-[var(--conflict-border)] bg-card/80 px-3.5 py-2.5 text-sm">
                <span className="font-semibold">{CONFLICT_KIND_LABEL[o.kind]} conflict</span>
                <span className="mt-0.5 block text-[var(--body-muted)]">{o.details}</span>
                <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                  Accepted {formatDate(o.overriddenAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
          {/* Reporting figures are management data, not calendar data. */}
          {canManage ? (
            <>
              <VarianceReadout
                label="Physical"
                subtitle={activity.performanceIndicator ?? "Physical target"}
                variance={variance.physical}
                delay={0.05}
              >
                <NarrativeBlock
                  variance={variance.physical}
                  notablePractice={activity.physicalNotablePractice}
                  justification={activity.physicalJustification}
                />
              </VarianceReadout>
              <VarianceReadout
                label="Financial"
                subtitle={activity.hasFinancialReq ? `Source of Fund · ${fund}` : "No financial requirement"}
                variance={variance.financial}
                money
                delay={0.1}
              >
                <NarrativeBlock
                  variance={variance.financial}
                  notablePractice={activity.financialNotablePractice}
                  justification={activity.financialJustification}
                />
              </VarianceReadout>
            </>
          ) : (
            <div className="anim-up" style={{ animationDelay: "0.05s" }}>
              {details}
            </div>
          )}

          {activity.reschedules.length > 0 && (
            <section
              className="surface anim-up overflow-hidden"
              style={{ animationDelay: "0.15s" }}
            >
              <h2 className="border-b border-[var(--grid-line)] px-6 py-4 text-[19px]">
                Catch-up Plan · {activity.reschedules.length}{" "}
                {activity.reschedules.length === 1 ? "postponement" : "postponements"}
              </h2>
              <ul className="divide-y divide-[var(--grid-line)]">
                {activity.reschedules.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1 px-6 py-3.5">
                    <p className="flex flex-wrap items-center gap-2.5 text-[15px] tabular-nums">
                      <span className="text-[var(--faint-foreground)] line-through">
                        {formatDateRange(r.previousStartDate, r.previousEndDate)}
                      </span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--status-rescheduled-solid)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      <strong>{formatDateRange(r.proposedStartDate, r.proposedEndDate)}</strong>
                    </p>
                    <p className="text-sm text-[var(--body-muted)]">“{r.reasonForPostponement}”</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {canManage && (
            <div className="anim-up" style={{ animationDelay: "0.2s" }}>
              <AttachmentList items={activity.attachments} />
            </div>
          )}

          {activity.reasonForDropping && (
            <section
              className="anim-up rounded-2xl bg-[var(--status-dropped-wash)] px-5 py-4"
              style={{ animationDelay: "0.2s" }}
            >
              <h2 className="eyebrow font-sans">Reason for dropping</h2>
              <p className="mt-1.5 text-[15px]">{activity.reasonForDropping}</p>
            </section>
          )}
        </div>

        <aside
          className="anim-up flex min-w-0 flex-[1_1_300px] flex-col gap-3.5"
          style={{ animationDelay: "0.1s" }}
        >
          {/* Hiding this is presentation only — the Server Actions behind it
              refuse a Viewer regardless of what the page renders. */}
          {canManage && (
            <div id="status-actions" className="scroll-mt-24">
              <StatusActions
                activityId={activity.id}
                status={activity.status}
                initial={{
                  physicalTarget: str(activity.physicalTarget),
                  physicalAccomplishment: str(activity.physicalAccomplishment),
                  financialTarget: str(activity.financialTarget),
                  financialAccomplishment: str(activity.financialAccomplishment),
                  physicalNotablePractice: activity.physicalNotablePractice ?? "",
                  physicalJustification: activity.physicalJustification ?? "",
                  financialNotablePractice: activity.financialNotablePractice ?? "",
                  financialJustification: activity.financialJustification ?? "",
                  startDate: toDateInput(activity.startDate),
                  endDate: toDateInput(activity.endDate),
                }}
              />
            </div>
          )}

          {canManage && details}

          <section className="surface overflow-hidden">
            <h2 className="eyebrow border-b border-[var(--grid-line)] px-5 py-3 font-sans">
              Participants
            </h2>
            {/* New bookings record a head count; older ones may name people. */}
            {activity.participantCount !== null && (
              <p className="flex items-baseline gap-2 px-5 py-4">
                <strong className="figure text-[28px] leading-none font-semibold">
                  {activity.participantCount}
                </strong>
                <span className="text-sm text-muted-foreground">
                  {activity.participantCount === 1 ? "participant" : "participants"} expected
                </span>
              </p>
            )}
            {activity.participants.length === 0 ? (
              activity.participantCount === null && (
                <p className="px-5 py-5 text-center text-sm text-muted-foreground">
                  Not recorded.
                </p>
              )
            ) : (
              <ul className="divide-y divide-[var(--grid-line)]">
                {activity.participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 px-5 py-2.5">
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--avatar-bg)] text-xs font-bold text-[var(--avatar-foreground)]"
                    >
                      {p.person.fullName.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.person.fullName}</span>
                      {p.person.position && (
                        <span className="block truncate text-xs text-muted-foreground">{p.person.position}</span>
                      )}
                    </span>
                    {p.person.division?.acronym && (
                      <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {p.person.division.acronym}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canManage && (
            <section className="surface flex flex-col gap-3 px-5 py-[18px]">
              <h2 className="eyebrow font-sans">History</h2>
              {/* A thread rather than a list: these entries are one thing that
                  happened repeatedly, and the order is the point. */}
              <ol className="flex flex-col gap-3 text-sm">
                {activity.statusHistory.map((h, i) => (
                  <li
                    key={h.id}
                    className="anim-up relative flex gap-2.5"
                    style={{ animationDelay: `${(0.2 + i * 0.06).toFixed(2)}s` }}
                  >
                    {i < activity.statusHistory.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-4 -bottom-4 left-[4.5px] w-px bg-[var(--grid-line)]"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className={`relative mt-[5px] size-2.5 shrink-0 rounded-full ${STATUS_DOT[h.toStatus]}`}
                    />
                    <span>
                      <strong>
                        {h.fromStatus === h.toStatus ? "" : h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} → ` : "Booked · "}
                        {STATUS_LABEL[h.toStatus]}
                      </strong>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {formatDate(h.changedAt)}
                      </span>
                      {h.note && (
                        <span className="mt-0.5 block text-[var(--body-muted)]">{h.note}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

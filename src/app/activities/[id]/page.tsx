import Link from "next/link";
import { notFound } from "next/navigation";

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

  const facts = [
    { label: "Dates", value: formatDateRange(activity.startDate, activity.endDate), mono: true },
    { label: "Duration", value: `${days} ${days === 1 ? "day" : "days"}`, mono: true },
    { label: "Venue", value: activity.venue?.name ?? "—" },
    { label: "Lead division", value: activity.leadDivision?.name ?? "—" },
    { label: "Focal person", value: activity.focalPerson?.fullName ?? "—" },
    { label: "Program", value: activity.program?.name ?? "—" },
    { label: "Type", value: TYPE_LABEL[activity.type] },
    { label: "Performance indicator", value: activity.performanceIndicator ?? "—" },
    {
      label: "Source of fund",
      value: activity.hasFinancialReq
        ? activity.sourceOfFund === "OTHER"
          ? activity.sourceOfFundOther ?? "Other"
          : activity.sourceOfFund
            ? FUND_LABEL[activity.sourceOfFund]
            : "—"
        : "No financial requirement",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/calendar" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5"><path d="m15 18-6-6 6-6" /></svg>
          Calendar
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight">
            {activity.title}
          </h1>
          <StatusBadge status={activity.status} />
        </div>
        <p className="mt-1.5 font-mono text-sm text-muted-foreground tabular-nums">
          {formatDateRange(activity.startDate, activity.endDate)}
          {activity.venue && ` · ${activity.venue.name}`}
        </p>
      </div>

      {canManage && activity.conflictOverrides.length > 0 && (
        <div className="rounded-lg border border-[var(--conflict)]/35 bg-[var(--conflict-bg)] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--conflict)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true" className="size-4"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            Booked over {activity.conflictOverrides.length}{" "}
            {activity.conflictOverrides.length === 1 ? "conflict" : "conflicts"}
          </h2>
          <ul className="mt-2.5 space-y-2">
            {activity.conflictOverrides.map((o) => (
              <li key={o.id} className="rounded-md border border-[var(--conflict)]/20 bg-card/70 px-3 py-2 text-[13px]">
                <span className="font-medium">{CONFLICT_KIND_LABEL[o.kind]} conflict</span>
                <span className="mt-0.5 block text-muted-foreground">{o.details}</span>
                <span className="mt-1 block font-mono text-[11px] text-muted-foreground tabular-nums">
                  Accepted {formatDate(o.overriddenAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="surface overflow-hidden">
            <h2 className="border-b border-[var(--grid-line)] px-4 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Details
            </h2>
            <dl className="grid gap-x-6 gap-y-3.5 p-4 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-[11px] text-muted-foreground">{f.label}</dt>
                  <dd className={`mt-0.5 text-sm ${f.mono ? "font-mono tabular-nums" : ""}`}>
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Reporting figures are management data, not calendar data. */}
          {canManage && (
          <section>
            <h2 className="mb-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Target vs. accomplishment
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <VarianceReadout label="Physical" variance={variance.physical} />
                <NarrativeBlock
                  variance={variance.physical}
                  notablePractice={activity.physicalNotablePractice}
                  justification={activity.physicalJustification}
                />
              </div>
              <div>
                <VarianceReadout label="Financial" variance={variance.financial} money />
                <NarrativeBlock
                  variance={variance.financial}
                  notablePractice={activity.financialNotablePractice}
                  justification={activity.financialJustification}
                />
              </div>
            </div>
          </section>
          )}

          {activity.reschedules.length > 0 && (
            <section className="surface overflow-hidden">
              <h2 className="border-b border-[var(--grid-line)] px-4 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                Catch-up plan · {activity.reschedules.length}{" "}
                {activity.reschedules.length === 1 ? "postponement" : "postponements"}
              </h2>
              <ul className="divide-y divide-[var(--grid-line)]">
                {activity.reschedules.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <p className="font-mono text-[13px] tabular-nums">
                      <span className="text-muted-foreground line-through">
                        {formatDateRange(r.previousStartDate, r.previousEndDate)}
                      </span>
                      <span aria-hidden="true" className="mx-2 text-muted-foreground">→</span>
                      <span className="font-medium">
                        {formatDateRange(r.proposedStartDate, r.proposedEndDate)}
                      </span>
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {r.reasonForPostponement}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {activity.reasonForDropping && (
            <section className="surface p-4">
              <h2 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                Reason for dropping
              </h2>
              <p className="mt-1.5 text-sm">{activity.reasonForDropping}</p>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {/* Hiding this is presentation only — the Server Actions behind it
              refuse a Viewer regardless of what the page renders. */}
          {canManage && (
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
          )}

          <section className="surface overflow-hidden">
            <h2 className="border-b border-[var(--grid-line)] px-4 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Participants · {activity.participants.length}
            </h2>
            {activity.participants.length === 0 ? (
              <p className="px-4 py-5 text-center text-[13px] text-muted-foreground">
                None recorded.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--grid-line)]">
                {activity.participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.person.fullName}</span>
                      {p.person.position && (
                        <span className="block truncate text-[11px] text-muted-foreground">{p.person.position}</span>
                      )}
                    </span>
                    {p.person.division?.acronym && (
                      <span className="shrink-0 rounded border border-[var(--grid-line)] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {p.person.division.acronym}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canManage && (
          <section className="surface overflow-hidden">
            <h2 className="border-b border-[var(--grid-line)] px-4 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              History
            </h2>
            <ol className="divide-y divide-[var(--grid-line)]">
              {activity.statusHistory.map((h) => (
                <li key={h.id} className="px-4 py-2.5 text-[13px]">
                  <span className="font-medium">
                    {h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} → ` : ""}
                    {STATUS_LABEL[h.toStatus]}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground tabular-nums">
                    {formatDate(h.changedAt)}
                  </span>
                  {h.note && <span className="mt-1 block text-muted-foreground">{h.note}</span>}
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

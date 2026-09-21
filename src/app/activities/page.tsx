import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { requireManagerPage } from "@/lib/authz";
import {
  formatCount,
  formatDateRange,
  formatPeso,
  TYPE_LABEL,
} from "@/lib/format";
import { listActivities } from "@/lib/queries";
import { computeActivityVariance } from "@/lib/variance";

export const dynamic = "force-dynamic";

const OUTCOME_STYLE = {
  GAIN: "text-[var(--gain)]",
  GAP: "text-[var(--gap)]",
  MET: "text-[var(--met)]",
} as const;

const OUTCOME_MARK = { GAIN: "▲", GAP: "▼", MET: "=" } as const;

export default async function RegisterPage() {
  await requireManagerPage();
  const activities = await listActivities();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] leading-none font-semibold tracking-tight">
          Register
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every active activity with its targets and computed variance. Dropped
          activities are in the{" "}
          <Link href="/archive" className="underline underline-offset-2 hover:text-foreground">archive</Link>.
        </p>
      </div>

      {activities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[var(--grid-line)] text-left">
                {["Activity", "Dates", "Division", "Venue", "Type", "Physical", "Financial", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--grid-line)]">
              {activities.map((a) => {
                const v = computeActivityVariance(a);
                return (
                  <tr key={a.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-3 py-2.5">
                      <Link href={`/activities/${a.id}`} className="font-medium hover:text-primary hover:underline">
                        {a.title}
                      </Link>
                      {a._count.conflictOverrides > 0 && (
                        <span title="Booked over a recorded conflict" className="ml-1.5 text-[var(--conflict)]">!</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDateRange(a.startDate, a.endDate)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {a.leadDivision?.acronym ?? a.leadDivision?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{a.venue?.name ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded border border-[var(--grid-line)] px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {TYPE_LABEL[a.type]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap tabular-nums">
                      {v.physical ? (
                        <span className={OUTCOME_STYLE[v.physical.outcome]}>
                          <span aria-hidden="true">{OUTCOME_MARK[v.physical.outcome]}</span>{" "}
                          {formatCount(v.physical.accomplishment)}/{formatCount(v.physical.target)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {a.physicalTarget ? `—/${formatCount(a.physicalTarget)}` : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap tabular-nums">
                      {v.financial ? (
                        <span className={OUTCOME_STYLE[v.financial.outcome]}>
                          <span aria-hidden="true">{OUTCOME_MARK[v.financial.outcome]}</span>{" "}
                          {formatPeso(v.financial.accomplishment)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {a.financialTarget ? formatPeso(a.financialTarget) : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="surface px-4 py-12 text-center">
      <p className="text-sm font-medium">No activities yet</p>
      <Link href="/activities/new" className="mt-3 inline-flex rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground">
        Book an Activity
      </Link>
    </div>
  );
}

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

/**
 * Every conflict someone knowingly booked over.
 *
 * The spec lets all three checks be waved through, which is correct — but
 * without this page the decision is made and then forgotten. This is the answer
 * to "who approved this double-booking?" months later.
 */
export default async function ConflictsPage() {
  await requireManagerPage();
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] leading-none font-semibold tracking-tight">
          Accepted conflicts
        </h1>
        <p className="mt-2 max-w-[75ch] text-sm text-muted-foreground">
          Bookings made over a date, venue or participant collision that someone
          chose to continue past. The system never blocks these — it records
          them, so the decision survives the meeting it was made in.
        </p>
      </div>

      {active.length === 0 ? (
        <div className="surface px-4 py-12 text-center">
          <p className="text-sm font-medium">No accepted conflicts</p>
          <p className="mx-auto mt-1 max-w-[42ch] text-[13px] text-muted-foreground">
            Nothing on the active calendar was booked over a collision.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {active.map((o) => (
            <li key={o.id} className="surface p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded border border-[var(--conflict)]/35 bg-[var(--conflict-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--conflict)]">
                  {KIND_LABEL[o.kind]}
                </span>
                <Link
                  href={`/activities/${o.activity.id}`}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {o.activity.title}
                </Link>
                <StatusBadge status={o.activity.status} />
                <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
                  Accepted {formatDate(o.overriddenAt)}
                </span>
              </div>

              <p className="mt-2 font-mono text-[13px] text-muted-foreground tabular-nums">
                {formatDateRange(o.activity.startDate, o.activity.endDate)}
                {o.activity.venue && ` · ${o.activity.venue.name}`}
                {o.activity.leadDivision &&
                  ` · ${o.activity.leadDivision.acronym ?? o.activity.leadDivision.name}`}
              </p>

              <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-[13px]">
                <span className="font-medium">Collided with:</span> {o.details}
              </p>

              <p className="mt-2 text-[11px] text-muted-foreground">
                {o.overriddenBy
                  ? `Accepted by ${o.overriddenBy.name ?? o.overriddenBy.email}`
                  : "Accepted before sign-in was enabled — no user recorded."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { requireManagerPage } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { formatDate, formatDateRange, TYPE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Dropped activities are soft-deleted, never removed. They leave the active
 * calendar and live here, and can be restored from their detail page.
 */
export default async function ArchivePage() {
  await requireManagerPage();
  const activities = await prisma.activity.findMany({
    where: { archivedAt: { not: null } },
    include: {
      venue: { select: { name: true } },
      leadDivision: { select: { acronym: true, name: true } },
    },
    orderBy: { archivedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] leading-none font-semibold tracking-tight">
          Archive
        </h1>
        <p className="mt-2 max-w-[75ch] text-sm text-muted-foreground">
          Dropped activities. They stay on record with their reason and can be
          restored to the calendar from their own page.
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="surface px-4 py-12 text-center">
          <p className="text-sm font-medium">Archive is empty</p>
          <p className="mx-auto mt-1 max-w-[42ch] text-[13px] text-muted-foreground">
            Nothing has been dropped.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {activities.map((a) => (
            <li key={a.id} className="surface p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href={`/activities/${a.id}`}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {a.title}
                </Link>
                <StatusBadge status={a.status} />
                <span className="rounded border border-[var(--grid-line)] px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {TYPE_LABEL[a.type]}
                </span>
                {a.archivedAt && (
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
                    Dropped {formatDate(a.archivedAt)}
                  </span>
                )}
              </div>

              <p className="mt-2 font-mono text-[13px] text-muted-foreground tabular-nums">
                {formatDateRange(a.startDate, a.endDate)}
                {a.venue && ` · ${a.venue.name}`}
                {a.leadDivision &&
                  ` · ${a.leadDivision.acronym ?? a.leadDivision.name}`}
              </p>

              {a.reasonForDropping && (
                <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-[13px]">
                  <span className="font-medium">Reason:</span>{" "}
                  {a.reasonForDropping}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

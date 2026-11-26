import { ArchiveList } from "@/components/archive-list";
import { canManageActivities, requireManagerPage } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { formatDate, formatDateRange, TYPE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Dropped activities are soft-deleted, never removed. They leave the active
 * calendar and live here, with their reason, and can be restored.
 */
export default async function ArchivePage() {
  const user = await requireManagerPage();
  const activities = await prisma.activity.findMany({
    where: { archivedAt: { not: null } },
    include: {
      venue: { select: { name: true } },
      leadDivision: { select: { acronym: true, name: true } },
      // The most recent move to Dropped says who dropped it.
      statusHistory: {
        where: { toStatus: "DROPPED" },
        orderBy: { changedAt: "desc" },
        take: 1,
        select: { changedBy: { select: { name: true, email: true } } },
      },
    },
    orderBy: { archivedAt: "desc" },
  });

  const items = activities.map((a) => {
    const by = a.statusHistory[0]?.changedBy;
    return {
      id: a.id,
      title: a.title,
      type: TYPE_LABEL[a.type],
      dropped: a.archivedAt ? formatDate(a.archivedAt) : null,
      where: [
        formatDateRange(a.startDate, a.endDate),
        a.venue?.name,
        a.leadDivision?.acronym ?? a.leadDivision?.name,
      ]
        .filter(Boolean)
        .join(" · "),
      reason: a.reasonForDropping,
      by: by?.name ?? by?.email ?? null,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-[22px]">
      <div className="anim-up flex max-w-[640px] flex-col gap-2.5">
        <h1 className="text-[32px] leading-tight sm:text-[36px]">Archive</h1>
        <p className="text-[17px] leading-relaxed text-[var(--body-muted)]">
          Dropped activities. They stay on record with their reason and can be
          restored to the calendar.
        </p>
      </div>

      <ArchiveList items={items} canRestore={canManageActivities(user.role)} />
    </div>
  );
}

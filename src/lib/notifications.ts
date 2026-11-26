import "server-only";

import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

/**
 * "New activity booked" notifications.
 *
 * A notification is simply an activity someone else booked recently — there
 * is no separate table to keep in step with the calendar. What a user has
 * already seen is a timestamp in a cookie, one per user, so marking them read
 * needs no database change. The trade-off: read state is per browser.
 */

const WINDOW_DAYS = 30;
const LIMIT = 15;
/** With no cookie yet, only the last week counts as new, not a month of backlog. */
const FIRST_VISIT_DAYS = 7;

export function seenCookieName(userId: string): string {
  return `coa_seen_${userId}`;
}

export interface BookingNotification {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  by: string | null;
  unread: boolean;
}

export async function getBookingNotifications(userId: string): Promise<{
  items: BookingNotification[];
  unread: number;
}> {
  const store = await cookies();
  const raw = store.get(seenCookieName(userId))?.value;
  const parsed = raw ? new Date(raw) : null;
  const seenAt =
    parsed && !Number.isNaN(parsed.getTime())
      ? parsed
      : new Date(Date.now() - FIRST_VISIT_DAYS * 86_400_000);

  const rows = await prisma.activity.findMany({
    where: {
      archivedAt: null,
      createdAt: { gte: new Date(Date.now() - WINDOW_DAYS * 86_400_000) },
      // Your own bookings are not news to you. Spelled out with OR because
      // a plain NOT would also drop rows whose booker is unknown (NULL).
      OR: [{ createdById: null }, { createdById: { not: userId } }],
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.startDate,
    endDate: r.endDate,
    createdAt: r.createdAt,
    by: r.createdBy?.name ?? r.createdBy?.email ?? null,
    unread: r.createdAt > seenAt,
  }));

  return { items, unread: items.filter((i) => i.unread).length };
}

import "server-only";

import { prisma } from "@/lib/db";

/**
 * Read paths for the calendar.
 *
 * The active calendar always filters `archivedAt: null`. Dropped activities are
 * soft-deleted and remain queryable through the archive view only.
 */

export type ActivityListItem = Awaited<ReturnType<typeof listActivities>>[number];

const LIST_SELECT = {
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  status: true,
  type: true,
  hasFinancialReq: true,
  sourceOfFund: true,
  physicalTarget: true,
  physicalAccomplishment: true,
  financialTarget: true,
  financialAccomplishment: true,
  program: { select: { id: true, name: true } },
  venue: { select: { id: true, name: true } },
  leadDivision: { select: { id: true, name: true, acronym: true } },
  focalPerson: { select: { id: true, fullName: true } },
  _count: { select: { participants: true, conflictOverrides: true } },
} as const;

export interface ActivityFilters {
  divisionId?: string;
  type?: "LND" | "NON_LND";
  status?: "PLANNED" | "CONDUCTED" | "RESCHEDULED" | "DROPPED";
  /** Inclusive window. Returns anything overlapping it. */
  from?: Date;
  to?: Date;
  includeArchived?: boolean;
}

export async function listActivities(filters: ActivityFilters = {}) {
  const { divisionId, type, status, from, to, includeArchived } = filters;

  return prisma.activity.findMany({
    where: {
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(divisionId ? { leadDivisionId: divisionId } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(from && to ? { startDate: { lte: to }, endDate: { gte: from } } : {}),
    },
    select: LIST_SELECT,
    orderBy: [{ startDate: "asc" }, { title: "asc" }],
  });
}

export async function getActivity(id: string) {
  return prisma.activity.findUnique({
    where: { id },
    include: {
      program: true,
      venue: true,
      leadDivision: true,
      focalPerson: { include: { division: true } },
      participants: {
        include: { person: { include: { division: true } } },
        orderBy: { person: { fullName: "asc" } },
      },
      attachments: { orderBy: { uploadedAt: "desc" } },
      conflictOverrides: { orderBy: { overriddenAt: "desc" } },
      statusHistory: { orderBy: { changedAt: "desc" } },
      reschedules: { orderBy: { createdAt: "desc" } },
    },
  });
}

/** Lookup lists for the booking form. Inactive rows are hidden from pickers. */
export async function getLookups() {
  const [divisions, programs, venues, people] = await Promise.all([
    prisma.division.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.program.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.venue.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.person.findMany({
      where: { isActive: true },
      include: { division: { select: { acronym: true } } },
      orderBy: { fullName: "asc" },
    }),
  ]);
  return { divisions, programs, venues, people };
}

/**
 * Counts for the header strip. `conflicts` counts activities carrying at least
 * one recorded override, which is the honest number: a conflict someone
 * knowingly accepted is still a conflict on the calendar.
 */
export async function getSummary() {
  const [planned, conducted, rescheduled, dropped, withOverrides] = await Promise.all([
    prisma.activity.count({ where: { archivedAt: null, status: "PLANNED" } }),
    prisma.activity.count({ where: { archivedAt: null, status: "CONDUCTED" } }),
    prisma.activity.count({ where: { archivedAt: null, status: "RESCHEDULED" } }),
    prisma.activity.count({ where: { status: "DROPPED" } }),
    prisma.activity.count({
      where: { archivedAt: null, conflictOverrides: { some: {} } },
    }),
  ]);
  return { planned, conducted, rescheduled, dropped, withOverrides };
}

/**
 * The next activities starting on or after `from`, regardless of which month
 * the calendar is showing. Keeps the rail useful when the visible month is
 * empty — an empty grid should not mean an empty screen.
 */
export async function listUpcoming(from: Date, take = 6) {
  return prisma.activity.findMany({
    where: { archivedAt: null, endDate: { gte: from } },
    select: LIST_SELECT,
    orderBy: { startDate: "asc" },
    take,
  });
}

/**
 * Accounts for the admin screen.
 *
 * `passwordHash` is deliberately never selected — this result crosses to a
 * Client Component, and a hash that reaches the browser is a hash an attacker
 * can take away and grind offline at their leisure.
 */
export type AccountListItem = Awaited<ReturnType<typeof listAccounts>>[number];

export async function listAccounts() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      divisionId: true,
      personId: true,
      division: { select: { id: true, name: true, acronym: true } },
      person: { select: { id: true, fullName: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

/**
 * Lookups for the account form. People already holding an account are still
 * listed, so an existing link keeps rendering its own name; the form marks
 * which are taken.
 */
export async function getAccountLookups() {
  const [divisions, people] = await Promise.all([
    prisma.division.findMany({
      where: { isActive: true },
      select: { id: true, name: true, acronym: true },
      orderBy: { name: "asc" },
    }),
    prisma.person.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, user: { select: { id: true } } },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return {
    divisions,
    people: people.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      takenBy: p.user?.id ?? null,
    })),
  };
}

/** Activities whose reschedule records form the catch-up plan. */
export async function listCatchUpPlan() {
  return prisma.activity.findMany({
    where: { archivedAt: null, status: "RESCHEDULED" },
    include: {
      leadDivision: { select: { name: true, acronym: true } },
      venue: { select: { name: true } },
      reschedules: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { startDate: "asc" },
  });
}

/**
 * Activities that have already ended but are still marked Planned.
 *
 * Nobody decides to leave these behind — an activity happens, everyone moves
 * on, and the record quietly keeps saying "Planned". The accomplishment report
 * is then wrong in a way no one is looking at, so the calendar has to raise it
 * rather than wait to be asked.
 */
export async function listAwaitingStatus(today: Date) {
  return prisma.activity.findMany({
    where: { archivedAt: null, status: "PLANNED", endDate: { lt: today } },
    select: LIST_SELECT,
    orderBy: { endDate: "asc" },
  });
}

/** The window the rail shows: anything overlapping today through today+days. */
export async function listWindow(from: Date, days = 7) {
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + days);
  return prisma.activity.findMany({
    where: { archivedAt: null, startDate: { lte: to }, endDate: { gte: from } },
    select: LIST_SELECT,
    orderBy: [{ startDate: "asc" }, { title: "asc" }],
  });
}

/** Divisions that can lead an activity, for the calendar's filter. */
export async function listDivisions() {
  return prisma.division.findMany({
    where: { isActive: true },
    select: { id: true, name: true, acronym: true },
    orderBy: { name: "asc" },
  });
}

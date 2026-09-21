import "server-only";

import { prisma } from "@/lib/db";
import type { ConflictKind } from "@/generated/prisma/enums";

/**
 * The three booking-phase conflict checks (spec Steps 2, 3, 4).
 *
 * All three are ADVISORY. Every one of them offers "Continue anyway", because
 * concurrent activities, shared venues and double-booked staff are all real and
 * sometimes intentional. The system's job is to make the collision visible at
 * the moment of decision, not to refuse the booking.
 *
 * Overriding one is recorded in `ConflictOverride` so the decision survives the
 * meeting it was made in.
 *
 * Scheduling is date-only and inclusive on both ends, so two activities overlap
 * when:   a.startDate <= b.endDate  AND  a.endDate >= b.startDate
 */

export interface ConflictWindow {
  startDate: Date;
  endDate: Date;
  /** Exclude this activity from results — set when editing an existing one. */
  excludeActivityId?: string;
}

export interface ConflictingActivity {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  venueName: string | null;
  leadDivisionName: string | null;
}

export interface ConflictResult {
  kind: ConflictKind;
  hasConflict: boolean;
  activities: ConflictingActivity[];
  /** Operator-facing alert text, phrased as in the spec. */
  message: string;
  /** Participants involved, for the PARTICIPANT check only. */
  affectedPeople?: { id: string; fullName: string }[];
}

/**
 * Shared predicate for every check. Dropped activities are excluded: a
 * cancelled activity occupies neither a date, a venue, nor a person.
 */
function baseWhere({ startDate, endDate, excludeActivityId }: ConflictWindow) {
  return {
    archivedAt: null,
    status: { not: "DROPPED" as const },
    startDate: { lte: endDate },
    endDate: { gte: startDate },
    ...(excludeActivityId ? { id: { not: excludeActivityId } } : {}),
  };
}

const SELECT = {
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  venue: { select: { name: true } },
  leadDivision: { select: { name: true } },
} as const;

type Row = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  venue: { name: string } | null;
  leadDivision: { name: string } | null;
};

function shape(rows: Row[]): ConflictingActivity[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.startDate,
    endDate: r.endDate,
    venueName: r.venue?.name ?? null,
    leadDivisionName: r.leadDivision?.name ?? null,
  }));
}

/**
 * Step 2 — Date validation.
 * Any non-dropped activity overlapping the window, regardless of venue or staff.
 */
export async function checkDateConflict(
  window: ConflictWindow,
): Promise<ConflictResult> {
  const rows = await prisma.activity.findMany({
    where: baseWhere(window),
    select: SELECT,
    orderBy: { startDate: "asc" },
  });

  return {
    kind: "DATE",
    hasConflict: rows.length > 0,
    activities: shape(rows as Row[]),
    message:
      "This date is already booked for another activity. Would you like to pick a new date or continue with a concurrent activity?",
  };
}

/**
 * Step 3 — Venue availability.
 * Only bookable venues are checked; shared/virtual venues such as "Online" are
 * flagged `isBookable: false` and never collide.
 */
export async function checkVenueConflict(
  venueId: string | null | undefined,
  window: ConflictWindow,
): Promise<ConflictResult> {
  const empty: ConflictResult = {
    kind: "VENUE",
    hasConflict: false,
    activities: [],
    message: "",
  };

  if (!venueId) return empty;

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { isBookable: true },
  });
  if (!venue?.isBookable) return empty;

  const rows = await prisma.activity.findMany({
    where: { ...baseWhere(window), venueId },
    select: SELECT,
    orderBy: { startDate: "asc" },
  });

  return {
    kind: "VENUE",
    hasConflict: rows.length > 0,
    activities: shape(rows as Row[]),
    message:
      "The selected venue is already scheduled for another activity on this date. Please verify the availability of other training halls within the venue or inform the Supply Office, or pick another schedule/venue.",
  };
}

/**
 * Step 4 — Participant availability.
 * Flags any selected participant already committed to an overlapping activity.
 */
export async function checkParticipantConflict(
  personIds: string[],
  window: ConflictWindow,
): Promise<ConflictResult> {
  if (personIds.length === 0) {
    return { kind: "PARTICIPANT", hasConflict: false, activities: [], message: "" };
  }

  const rows = await prisma.activity.findMany({
    where: {
      ...baseWhere(window),
      participants: { some: { personId: { in: personIds } } },
    },
    select: {
      ...SELECT,
      participants: {
        where: { personId: { in: personIds } },
        select: { person: { select: { id: true, fullName: true } } },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Deduplicate: one person double-booked across two activities should appear
  // once in the alert, not twice.
  const affected = new Map<string, { id: string; fullName: string }>();
  for (const row of rows) {
    for (const p of row.participants) {
      affected.set(p.person.id, p.person);
    }
  }

  return {
    kind: "PARTICIPANT",
    hasConflict: rows.length > 0,
    activities: shape(rows as unknown as Row[]),
    affectedPeople: [...affected.values()],
    message:
      "Conflict Detected: Participants are already booked for another activity. The continuance may cause problems with the schedule of participants.",
  };
}

export interface BookingCheckInput extends ConflictWindow {
  venueId?: string | null;
  participantIds?: string[];
}

/**
 * Runs all three checks together. The wizard shows them step by step, but the
 * server re-runs the full set on submit — a client that skipped a step, or a
 * calendar that changed while the form sat open, must not slip past unchecked.
 */
export async function runAllConflictChecks(
  input: BookingCheckInput,
): Promise<ConflictResult[]> {
  const window: ConflictWindow = {
    startDate: input.startDate,
    endDate: input.endDate,
    excludeActivityId: input.excludeActivityId,
  };

  const [date, venue, participant] = await Promise.all([
    checkDateConflict(window),
    checkVenueConflict(input.venueId, window),
    checkParticipantConflict(input.participantIds ?? [], window),
  ]);

  return [date, venue, participant].filter((c) => c.hasConflict);
}

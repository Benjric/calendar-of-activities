"use server";

import { revalidatePath } from "next/cache";

import {
  AuthorizationError,
  getCurrentUser,
  requireManagerAction,
} from "@/lib/authz";
import { runAllConflictChecks, type ConflictResult } from "@/lib/conflicts";
import { prisma } from "@/lib/db";
import { parseDateInput } from "@/lib/format";
import {
  bookingSchema,
  conductedSchema,
  dropSchema,
  rescheduleSchema,
} from "@/lib/validation";
import { resolveOrCreateProgram } from "@/lib/programs";
import { findVenueByName, resolveOrCreateVenue } from "@/lib/venues";
import { computeVariance } from "@/lib/variance";

/**
 * Mutations.
 *
 * Every conflict check re-runs here on submit. The wizard shows them step by
 * step, but a client that skipped ahead — or a calendar that changed while the
 * form sat open — must not slip past unchecked.
 *
 * Conflicts never block. They are returned to the caller, which shows them and
 * lets the user proceed; proceeding records a ConflictOverride so the decision
 * survives the meeting it was made in.
 */

export interface ActionResult {
  ok: boolean;
  /** Field-level validation errors, keyed by field name. */
  errors?: Record<string, string>;
  /** Unacknowledged conflicts. The caller shows these and may resubmit. */
  conflicts?: ConflictResult[];
  activityId?: string;
  message?: string;
}

function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}

/** Serialises a conflict for transport across the server/client boundary. */
function summariseConflict(c: ConflictResult): string {
  const names = c.activities
    .map((a) => a.title)
    .slice(0, 5)
    .join("; ");
  const extra = c.activities.length > 5 ? ` (+${c.activities.length - 5} more)` : "";
  const people = c.affectedPeople?.length
    ? ` — affecting ${c.affectedPeople.map((p) => p.fullName).join(", ")}`
    : "";
  return `${names}${extra}${people}`;
}

/**
 * Wraps an action so an unauthorized call returns a clean result instead of an
 * unhandled server exception.
 */
async function guard<T>(
  fn: (userId: string) => Promise<T>,
): Promise<T | ActionResult> {
  try {
    const user = await requireManagerAction();
    return await fn(user.id);
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return { ok: false, message: e.message } satisfies ActionResult;
    }
    throw e;
  }
}

export async function bookActivity(raw: unknown): Promise<ActionResult> {
  return guard(async (userId) =>
    bookActivityAuthorized(raw, userId),
  ) as Promise<ActionResult>;
}

async function bookActivityAuthorized(
  raw: unknown,
  userId: string,
): Promise<ActionResult> {
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const startDate = parseDateInput(input.startDate)!;
  const endDate = parseDateInput(input.endDate)!;

  // A typed venue name is resolved to an existing venue, or becomes one. This
  // happens before the conflict check so a reused venue is still checked.
  const venue = input.venueName
    ? await resolveOrCreateVenue(input.venueName)
    : null;

  // Programs resolve the same way, but take no part in conflict checking —
  // two activities under one program are not a clash.
  const program = input.programName
    ? await resolveOrCreateProgram(input.programName)
    : null;

  const conflicts = await runAllConflictChecks({
    startDate,
    endDate,
    venueId: venue?.id ?? null,
    participantIds: input.participantIds,
  });

  const unacknowledged = conflicts.filter(
    (c) => !input.acknowledgedConflicts.includes(c.kind),
  );
  if (unacknowledged.length > 0) {
    return { ok: false, conflicts: unacknowledged };
  }

  const activity = await prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        title: input.title,
        programId: program?.id,
        startDate,
        endDate,
        venueId: venue?.id,
        leadDivisionId: input.leadDivisionId,
        focalPersonId: input.focalPersonId,
        type: input.type,
        performanceIndicator: input.performanceIndicator,
        hasFinancialReq: input.hasFinancialReq,
        sourceOfFund: input.hasFinancialReq ? input.sourceOfFund : undefined,
        sourceOfFundOther:
          input.sourceOfFund === "OTHER" ? input.sourceOfFundOther : undefined,
        physicalTarget: input.physicalTarget,
        financialTarget: input.financialTarget,
        status: "PLANNED",
        createdById: userId,
        participants: {
          create: input.participantIds.map((personId) => ({ personId })),
        },
      },
    });

    // Record every conflict the user chose to proceed past, with who accepted it.
    for (const c of conflicts) {
      await tx.conflictOverride.create({
        data: {
          activityId: created.id,
          kind: c.kind,
          details: summariseConflict(c),
          conflictingActivityIds: c.activities.map((a) => a.id),
          overriddenById: userId,
        },
      });
    }

    await tx.statusHistory.create({
      data: { activityId: created.id, toStatus: "PLANNED", changedById: userId },
    });

    return created;
  });

  revalidatePath("/calendar");
  return { ok: true, activityId: activity.id };
}

/**
 * Checks conflicts without saving. Drives the live warnings in the wizard as
 * the user picks dates, venue, and participants.
 */
export async function checkConflicts(input: {
  startDate: string;
  endDate: string;
  venueName?: string | null;
  participantIds?: string[];
  excludeActivityId?: string;
}): Promise<ConflictResult[]> {
  await requireSignedIn();

  const startDate = parseDateInput(input.startDate);
  const endDate = parseDateInput(input.endDate);
  if (!startDate || !endDate || endDate < startDate) return [];

  // Look the name up WITHOUT creating it — checking availability must not
  // litter the venue list with half-typed names.
  const venue = input.venueName ? await findVenueByName(input.venueName) : null;

  return runAllConflictChecks({
    startDate,
    endDate,
    venueId: venue?.id ?? null,
    participantIds: input.participantIds ?? [],
    excludeActivityId: input.excludeActivityId,
  });
}

/**
 * Marks an activity Conducted and records the reporting figures.
 *
 * The narrative requirement is derived, not fixed: a Gain requires a Notable
 * Practice, a Gap requires a Justification, and Met requires neither. Each
 * dimension is judged on its own sign, so one submission can require a Notable
 * Practice for physical and a Justification for financial at the same time.
 */
export async function recordConducted(raw: unknown): Promise<ActionResult> {
  return guard(async (userId) =>
    recordConductedAuthorized(raw, userId),
  ) as Promise<ActionResult>;
}

async function recordConductedAuthorized(
  raw: unknown,
  userId: string,
): Promise<ActionResult> {
  const parsed = conductedSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const errors: Record<string, string> = {};

  const physical = computeVariance(input.physicalTarget, input.physicalAccomplishment);
  const financial = computeVariance(input.financialTarget, input.financialAccomplishment);

  if (physical?.requiredNarrative === "notablePractice" && !input.physicalNotablePractice) {
    errors.physicalNotablePractice =
      "Physical accomplishment exceeded the target. Describe the notable practice.";
  }
  if (physical?.requiredNarrative === "justification" && !input.physicalJustification) {
    errors.physicalJustification =
      "Physical accomplishment fell short of the target. A justification is required.";
  }
  if (financial?.requiredNarrative === "notablePractice" && !input.financialNotablePractice) {
    errors.financialNotablePractice =
      "Financial accomplishment exceeded the target. Describe the notable practice.";
  }
  if (financial?.requiredNarrative === "justification" && !input.financialJustification) {
    errors.financialJustification =
      "Financial accomplishment fell short of the target. A justification is required.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  await prisma.$transaction(async (tx) => {
    const before = await tx.activity.findUnique({
      where: { id: input.activityId },
      select: { status: true },
    });

    await tx.activity.update({
      where: { id: input.activityId },
      data: {
        status: "CONDUCTED",
        conductedAt: new Date(),
        physicalTarget: input.physicalTarget,
        physicalAccomplishment: input.physicalAccomplishment,
        financialTarget: input.financialTarget,
        financialAccomplishment: input.financialAccomplishment,
        // Clear the narrative that this dimension's sign does not call for, so a
        // Gap corrected into a Gain cannot leave a stale justification behind.
        physicalNotablePractice:
          physical?.requiredNarrative === "notablePractice"
            ? input.physicalNotablePractice
            : null,
        physicalJustification:
          physical?.requiredNarrative === "justification"
            ? input.physicalJustification
            : null,
        financialNotablePractice:
          financial?.requiredNarrative === "notablePractice"
            ? input.financialNotablePractice
            : null,
        financialJustification:
          financial?.requiredNarrative === "justification"
            ? input.financialJustification
            : null,
      },
    });

    await tx.statusHistory.create({
      data: {
        activityId: input.activityId,
        fromStatus: before?.status,
        toStatus: "CONDUCTED",
        changedById: userId,
      },
    });
  });

  revalidatePath("/calendar");
  revalidatePath(`/activities/${input.activityId}`);
  return { ok: true, activityId: input.activityId };
}

export async function rescheduleActivity(raw: unknown): Promise<ActionResult> {
  return guard(async (userId) =>
    rescheduleActivityAuthorized(raw, userId),
  ) as Promise<ActionResult>;
}

async function rescheduleActivityAuthorized(
  raw: unknown,
  userId: string,
): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const proposedStart = parseDateInput(input.proposedStartDate)!;
  const proposedEnd = parseDateInput(input.proposedEndDate)!;

  const existing = await prisma.activity.findUnique({
    where: { id: input.activityId },
    select: {
      status: true,
      startDate: true,
      endDate: true,
      venueId: true,
      participants: { select: { personId: true } },
    },
  });
  if (!existing) return { ok: false, message: "Activity not found." };

  // The new schedule is re-run through the same checks the booking used.
  const conflicts = await runAllConflictChecks({
    startDate: proposedStart,
    endDate: proposedEnd,
    venueId: existing.venueId,
    participantIds: existing.participants.map((p) => p.personId),
    excludeActivityId: input.activityId,
  });

  const unacknowledged = conflicts.filter(
    (c) => !input.acknowledgedConflicts.includes(c.kind),
  );
  if (unacknowledged.length > 0) return { ok: false, conflicts: unacknowledged };

  await prisma.$transaction(async (tx) => {
    await tx.rescheduleRecord.create({
      data: {
        activityId: input.activityId,
        reasonForPostponement: input.reasonForPostponement,
        previousStartDate: existing.startDate,
        previousEndDate: existing.endDate,
        proposedStartDate: proposedStart,
        proposedEndDate: proposedEnd,
        createdById: userId,
      },
    });

    await tx.activity.update({
      where: { id: input.activityId },
      data: {
        status: "RESCHEDULED",
        startDate: proposedStart,
        endDate: proposedEnd,
      },
    });

    for (const c of conflicts) {
      await tx.conflictOverride.create({
        data: {
          activityId: input.activityId,
          kind: c.kind,
          details: summariseConflict(c),
          conflictingActivityIds: c.activities.map((a) => a.id),
          overriddenById: userId,
        },
      });
    }

    await tx.statusHistory.create({
      data: {
        activityId: input.activityId,
        fromStatus: existing.status,
        toStatus: "RESCHEDULED",
        note: input.reasonForPostponement,
        changedById: userId,
      },
    });
  });

  revalidatePath("/calendar");
  revalidatePath(`/activities/${input.activityId}`);
  return { ok: true, activityId: input.activityId };
}

export async function dropActivity(raw: unknown): Promise<ActionResult> {
  return guard(async (userId) =>
    dropActivityAuthorized(raw, userId),
  ) as Promise<ActionResult>;
}

async function dropActivityAuthorized(
  raw: unknown,
  userId: string,
): Promise<ActionResult> {
  const parsed = dropSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const input = parsed.data;

  await prisma.$transaction(async (tx) => {
    const before = await tx.activity.findUnique({
      where: { id: input.activityId },
      select: { status: true },
    });

    // Soft delete: archived out of the active calendar, still in the archive.
    await tx.activity.update({
      where: { id: input.activityId },
      data: {
        status: "DROPPED",
        reasonForDropping: input.reasonForDropping,
        archivedAt: new Date(),
      },
    });

    await tx.statusHistory.create({
      data: {
        activityId: input.activityId,
        fromStatus: before?.status,
        toStatus: "DROPPED",
        note: input.reasonForDropping,
        changedById: userId,
      },
    });
  });

  revalidatePath("/calendar");
  revalidatePath(`/activities/${input.activityId}`);
  return { ok: true, activityId: input.activityId };
}

/** Restores a dropped activity to the active calendar. */
export async function restoreActivity(activityId: string): Promise<ActionResult> {
  return guard(async (userId) => {
    await prisma.$transaction(async (tx) => {
      await tx.activity.update({
        where: { id: activityId },
        data: { status: "PLANNED", archivedAt: null, reasonForDropping: null },
      });
      await tx.statusHistory.create({
        data: {
          activityId,
          fromStatus: "DROPPED",
          toStatus: "PLANNED",
          changedById: userId,
        },
      });
    });

    revalidatePath("/calendar");
    revalidatePath(`/activities/${activityId}`);
    return { ok: true, activityId } satisfies ActionResult;
  }) as Promise<ActionResult>;
}

/**
 * Conflict checking is a read, so any signed-in user may run it — but it must
 * still require a session, since it reveals what the calendar contains.
 */
async function requireSignedIn() {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("You must be signed in.");
  return user;
}

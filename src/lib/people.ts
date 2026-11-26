import "server-only";

import { prisma } from "@/lib/db";

/**
 * Focal persons are typed, not picked from a fixed list.
 *
 * Same reasoning as venues and programs: the office does not keep a list of
 * people up front. The first time a name is used as a focal person it is
 * created; afterwards it is suggested, so the same person is never retyped
 * and the list builds itself out of actual bookings.
 */

/** "Ana  Cruz " and "Ana Cruz" must not become two people. */
export function normalisePersonName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Case-insensitive lookup, so "ana cruz" finds "Ana Cruz". Active people first. */
export async function findPersonByName(name: string) {
  const clean = normalisePersonName(name);
  if (!clean) return null;

  return prisma.person.findFirst({
    where: { fullName: { equals: clean, mode: "insensitive" } },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });
}

/**
 * Returns the person with this name, creating them if they are new. A new
 * person is placed in the activity's lead division, if one was chosen — the
 * focal person almost always belongs to the division that leads it.
 *
 * Resolved outside the booking transaction, like venues and programs, so the
 * name survives even if the booking itself is rolled back.
 */
export async function resolveOrCreatePerson(
  name: string,
  divisionId?: string,
): Promise<{ id: string; fullName: string; created: boolean } | null> {
  const clean = normalisePersonName(name);
  if (!clean) return null;

  const existing = await findPersonByName(clean);
  if (existing) {
    return { id: existing.id, fullName: existing.fullName, created: false };
  }

  const created = await prisma.person.create({
    data: { fullName: clean, divisionId: divisionId || undefined },
  });
  return { id: created.id, fullName: created.fullName, created: true };
}

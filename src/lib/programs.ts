import "server-only";

import { prisma } from "@/lib/db";

/**
 * Programs are typed, not picked from a fixed list.
 *
 * Same reasoning as venues: the office does not maintain a program list up
 * front. The first time a program name is used it is created; afterwards it
 * appears as a suggestion, so the same program is never retyped and the real
 * list builds itself out of actual bookings.
 */

/**
 * Collapses internal whitespace and trims. "Policy  Orientation " and
 * "Policy Orientation" must not become two programs.
 */
export function normaliseProgramName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Case-insensitive lookup, so "policy orientation" finds "Policy Orientation". */
export async function findProgramByName(name: string) {
  const clean = normaliseProgramName(name);
  if (!clean) return null;

  return prisma.program.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
  });
}

/**
 * Returns the id of the program with this name, creating it if it is new.
 *
 * Resolved outside the booking transaction so a newly created program survives
 * even if the booking itself is later rolled back — the name is still a real
 * program the office used.
 */
export async function resolveOrCreateProgram(
  name: string,
): Promise<{ id: string; name: string; created: boolean } | null> {
  const clean = normaliseProgramName(name);
  if (!clean) return null;

  const existing = await findProgramByName(clean);
  if (existing) {
    return { id: existing.id, name: existing.name, created: false };
  }

  try {
    const created = await prisma.program.create({ data: { name: clean } });
    return { id: created.id, name: created.name, created: true };
  } catch {
    // Another request created the same program between the lookup and the
    // insert. The unique constraint did its job; take whichever row won.
    const raced = await findProgramByName(clean);
    if (raced) {
      return { id: raced.id, name: raced.name, created: false };
    }
    return null;
  }
}

/** Names offered as suggestions. */
export async function listProgramNames(): Promise<
  { id: string; name: string }[]
> {
  return prisma.program.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

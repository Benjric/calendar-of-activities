import "server-only";

import { prisma } from "@/lib/db";

/**
 * Venues are typed, not picked from a fixed list.
 *
 * The first time a venue name is used it is created; afterwards it appears as a
 * suggestion, so the same hall is never retyped. The office's real venue list
 * therefore builds itself out of actual bookings instead of needing to be
 * entered up front.
 */

/**
 * Collapses internal whitespace and trims. "Main  Training Hall " and
 * "Main Training Hall" must not become two venues.
 */
export function normaliseVenueName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Case-insensitive lookup, so "conference room a" finds "Conference Room A". */
export async function findVenueByName(name: string) {
  const clean = normaliseVenueName(name);
  if (!clean) return null;

  return prisma.venue.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
  });
}

/**
 * Returns the id of the venue with this name, creating it if it is new.
 *
 * Resolved outside the booking transaction so a newly created venue survives
 * even if the booking itself is later rolled back — the name is still a real
 * venue the office used.
 */
export async function resolveOrCreateVenue(
  name: string,
): Promise<{ id: string; name: string; isBookable: boolean; created: boolean } | null> {
  const clean = normaliseVenueName(name);
  if (!clean) return null;

  const existing = await findVenueByName(clean);
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      isBookable: existing.isBookable,
      created: false,
    };
  }

  try {
    const created = await prisma.venue.create({
      data: { name: clean, isBookable: true },
    });
    return {
      id: created.id,
      name: created.name,
      isBookable: created.isBookable,
      created: true,
    };
  } catch {
    // Another request created the same venue between the lookup and the insert.
    // The unique constraint did its job; take whichever row won.
    const raced = await findVenueByName(clean);
    if (raced) {
      return {
        id: raced.id,
        name: raced.name,
        isBookable: raced.isBookable,
        created: false,
      };
    }
    return null;
  }
}

/** Names offered as suggestions, most recently used first. */
export async function listVenueNames(): Promise<
  { id: string; name: string; location: string | null; capacity: number | null; isBookable: boolean }[]
> {
  return prisma.venue.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      location: true,
      capacity: true,
      isBookable: true,
    },
    orderBy: { name: "asc" },
  });
}

import { createRequire } from "node:module";

import "dotenv/config";

/**
 * `src/lib/venues.ts` imports `server-only`, which throws outside a React
 * Server Component. That guard is correct in the app and simply needs stubbing
 * to exercise the real module here — the alternative would be deleting a real
 * safety check to make a test pass.
 */
const req = createRequire(import.meta.url);
req.cache[req.resolve("server-only")] = {
  id: "server-only",
  filename: "server-only",
  loaded: true,
  exports: {},
} as unknown as NodeJS.Module;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`,
  );
}

const NEW_NAME = "Barangay Hall Annex";

async function main() {
  // Imported after the stub above is installed.
  const { prisma } = await import("@/lib/db");
  const { findVenueByName, normaliseVenueName, resolveOrCreateVenue } =
    await import("@/lib/venues");

  console.log("\n=== Name normalisation ===");
  check("trims", normaliseVenueName("  Hall  "), "Hall");
  check(
    "collapses internal whitespace",
    normaliseVenueName("Main  Training   Hall"),
    "Main Training Hall",
  );

  console.log("\n=== Existing venues are reused, never duplicated ===");
  const before = await prisma.venue.count();
  const exact = await resolveOrCreateVenue("Main Training Hall");
  check("exact name resolves to existing", exact?.created, false);

  const lower = await resolveOrCreateVenue("main training hall");
  check("lowercase resolves to the SAME venue", lower?.id, exact?.id);

  const spaced = await resolveOrCreateVenue("Main   Training  Hall");
  check("messy whitespace resolves to the SAME venue", spaced?.id, exact?.id);
  check("none of those created a venue", await prisma.venue.count(), before);

  console.log("\n=== A new name is created once, then remembered ===");
  await prisma.venue.deleteMany({ where: { name: NEW_NAME } });

  const first = await resolveOrCreateVenue(NEW_NAME);
  check("first use creates it", first?.created, true);
  check("stored under the normalised name", first?.name, NEW_NAME);
  check("new venues are conflict-checked by default", first?.isBookable, true);

  const second = await resolveOrCreateVenue("  Barangay   Hall Annex  ");
  check("messy whitespace reuses it", second?.created, false);
  check("  ...same row", second?.id, first?.id);

  const third = await resolveOrCreateVenue("BARANGAY HALL ANNEX");
  check("different case reuses it", third?.created, false);
  check("  ...same row", third?.id, first?.id);

  const suggestions = await prisma.venue.findMany({
    where: { isActive: true },
    select: { name: true },
  });
  check(
    "appears in the suggestion list for next time",
    suggestions.some((v) => v.name === NEW_NAME),
    true,
  );

  console.log("\n=== Checking availability never creates a venue ===");
  const countBefore = await prisma.venue.count();
  check("half-typed name returns null", await findVenueByName("Half Typed Ven"), null);
  check("nothing created by looking up", await prisma.venue.count(), countBefore);

  console.log("\n=== Blank input is not a venue ===");
  check("empty string resolves to null", await resolveOrCreateVenue(""), null);
  check("whitespace-only resolves to null", await resolveOrCreateVenue("   "), null);
  check("still nothing created", await prisma.venue.count(), countBefore);

  await prisma.venue.deleteMany({ where: { name: NEW_NAME } });

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} FAILED\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main();

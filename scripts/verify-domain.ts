import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { PrismaClient } from "@/generated/prisma/client";
import { computeVariance, computeActivityVariance } from "@/lib/variance";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function d(y: number, m: number, day: number) {
  return new Date(Date.UTC(y, m - 1, day));
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`,
  );
}

async function main() {
  console.log("\n=== Variance (spec: result = accomplishment - target) ===");
  check("115 vs 100 -> GAIN", computeVariance(100, 115)?.outcome, "GAIN");
  check("GAIN reveals notablePractice", computeVariance(100, 115)?.requiredNarrative, "notablePractice");
  check("232000 vs 250000 -> GAP", computeVariance(250000, 232000)?.outcome, "GAP");
  check("GAP reveals justification", computeVariance(250000, 232000)?.requiredNarrative, "justification");
  check("50 vs 50 -> MET", computeVariance(50, 50)?.outcome, "MET");
  check("MET reveals nothing", computeVariance(50, 50)?.requiredNarrative, null);
  check("result is accomplishment - target", computeVariance(100, 115)?.result, 15);
  check("unreported accomplishment is not a Gap", computeVariance(100, null), null);
  check("float drift absorbed (0.1+0.2 vs 0.3)", computeVariance(0.3, 0.1 + 0.2)?.outcome, "MET");
  check("zero target -> null rate, not Infinity", computeVariance(0, 5)?.achievementRate, null);

  console.log("\n=== Independent physical/financial variance ===");
  const sample = await prisma.activity.findFirst({
    where: { title: { startsWith: "[SAMPLE] Instructional" } },
  });
  const v = computeActivityVariance(sample!);
  check("physical is GAIN", v.physical?.outcome, "GAIN");
  check("financial is GAP", v.financial?.outcome, "GAP");
  check("Decimal columns arithmetic correctly", v.physical?.result, 15);
  console.log("        -> one activity showing a Gain box AND a Gap box at once");

  console.log("\n=== Conflict overlap predicate (date-only, inclusive) ===");
  const overlapWhere = (start: Date, end: Date) => ({
    archivedAt: null,
    status: { not: "DROPPED" as const },
    startDate: { lte: end },
    endDate: { gte: start },
  });

  const oct = await prisma.activity.findMany({
    where: overlapWhere(d(2026, 10, 5), d(2026, 10, 6)),
    select: { title: true },
  });
  check("Oct 5-6 finds 2 overlapping activities", oct.length, 2);

  const touch = await prisma.activity.findMany({
    where: overlapWhere(d(2026, 10, 7), d(2026, 10, 9)),
    select: { title: true },
  });
  check("Oct 7-9 touches Oct 5-7 on its last day", touch.length, 1);

  const clear = await prisma.activity.findMany({
    where: overlapWhere(d(2026, 10, 8), d(2026, 10, 9)),
    select: { title: true },
  });
  check("Oct 8-9 is clear", clear.length, 0);

  console.log("\n=== Dropped activities occupy nothing ===");
  const droppedDay = await prisma.activity.findMany({
    where: overlapWhere(d(2026, 9, 21), d(2026, 9, 21)),
    select: { title: true },
  });
  check("dropped Sep 21 does not block its own date", droppedDay.length, 0);

  console.log("\n=== Venue check skips non-bookable venues ===");
  const online = await prisma.venue.findUnique({ where: { name: "Online / MS Teams" } });
  check("Online venue is non-bookable", online?.isBookable, false);

  console.log("\n=== Participant conflict finds shared people ===");
  const partConflict = await prisma.activity.findMany({
    where: {
      ...overlapWhere(d(2026, 8, 10), d(2026, 8, 12)),
      participants: { some: { person: { fullName: "Jose Reyes" } } },
    },
    select: { title: true },
  });
  check("Jose Reyes is booked Aug 10-12", partConflict.length, 1);

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} FAILED\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main();

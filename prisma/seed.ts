import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Development seed.
 *
 * The divisions, venues, programs and people below are PLACEHOLDERS so there is
 * something to build the UI against. Replace them with the real office lists
 * before this goes anywhere near production.
 *
 * Idempotent: re-running upserts rather than duplicating.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Builds a date-only UTC value, matching the `@db.Date` columns. */
function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

const DIVISIONS = [
  { name: "Human Resource Development", acronym: "HRD" },
  { name: "Curriculum Implementation", acronym: "CID" },
  { name: "School Governance and Operations", acronym: "SGOD" },
  { name: "Finance", acronym: "FIN" },
  { name: "Administrative Services", acronym: "ADMIN" },
];

const PROGRAMS = [
  "Leadership and Management Development",
  "Teaching Effectiveness",
  "Technical Skills Enhancement",
  "Values and Wellness",
  "Policy Orientation",
];

const VENUES = [
  { name: "Main Training Hall", location: "2nd Floor, Main Building", capacity: 120, isBookable: true },
  { name: "Conference Room A", location: "3rd Floor, Annex", capacity: 40, isBookable: true },
  { name: "Conference Room B", location: "3rd Floor, Annex", capacity: 40, isBookable: true },
  { name: "Multipurpose Hall", location: "Ground Floor", capacity: 250, isBookable: true },
  // Non-bookable venues never trigger the Step 3 availability check.
  { name: "Online / MS Teams", location: null, capacity: null, isBookable: false },
];

const PEOPLE = [
  { fullName: "Maria Santos", position: "Education Program Supervisor", division: "HRD" },
  { fullName: "Jose Reyes", position: "Senior Education Program Specialist", division: "HRD" },
  { fullName: "Ana Cruz", position: "Education Program Supervisor", division: "CID" },
  { fullName: "Pedro Bautista", position: "Project Development Officer", division: "SGOD" },
  { fullName: "Liza Mendoza", position: "Administrative Officer", division: "ADMIN" },
  { fullName: "Carlos Villanueva", position: "Accountant", division: "FIN" },
  { fullName: "Grace Lim", position: "Education Program Specialist", division: "CID" },
  { fullName: "Ramon Dela Cruz", position: "Administrative Assistant", division: "ADMIN" },
];

async function main() {
  console.log("Seeding…");

  const divisions = new Map<string, string>();
  for (const div of DIVISIONS) {
    const row = await prisma.division.upsert({
      where: { name: div.name },
      update: { acronym: div.acronym },
      create: div,
    });
    divisions.set(div.acronym, row.id);
  }
  console.log(`  divisions: ${divisions.size}`);

  const programs = new Map<string, string>();
  for (const name of PROGRAMS) {
    const row = await prisma.program.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    programs.set(name, row.id);
  }
  console.log(`  programs: ${programs.size}`);

  const venues = new Map<string, string>();
  for (const venue of VENUES) {
    const row = await prisma.venue.upsert({
      where: { name: venue.name },
      update: { location: venue.location, capacity: venue.capacity, isBookable: venue.isBookable },
      create: venue,
    });
    venues.set(venue.name, row.id);
  }
  console.log(`  venues: ${venues.size}`);

  const people = new Map<string, string>();
  for (const person of PEOPLE) {
    const email = `${person.fullName.toLowerCase().replace(/\s+/g, ".")}@example.gov.ph`;
    const row = await prisma.person.upsert({
      where: { email },
      update: { position: person.position, divisionId: divisions.get(person.division) },
      create: {
        fullName: person.fullName,
        position: person.position,
        email,
        divisionId: divisions.get(person.division),
      },
    });
    people.set(person.fullName, row.id);
  }
  console.log(`  people: ${people.size}`);

  // --- Sample activities, one per lifecycle state -------------------------
  // Deleted and recreated so reseeding stays deterministic.
  await prisma.activity.deleteMany({ where: { title: { startsWith: "[SAMPLE]" } } });

  // CONDUCTED with a physical Gain and a financial Gap simultaneously — the
  // exact case that requires two independent narrative fields.
  const conducted = await prisma.activity.create({
    data: {
      title: "[SAMPLE] Instructional Leadership Training",
      programId: programs.get("Leadership and Management Development"),
      startDate: d(2026, 8, 10),
      endDate: d(2026, 8, 12),
      venueId: venues.get("Main Training Hall"),
      leadDivisionId: divisions.get("HRD"),
      focalPersonId: people.get("Maria Santos"),
      type: "LND",
      performanceIndicator: "No. of school heads trained",
      hasFinancialReq: true,
      sourceOfFund: "HRTD",
      status: "CONDUCTED",
      conductedAt: d(2026, 8, 12),
      physicalTarget: 100,
      physicalAccomplishment: 115,
      financialTarget: 250000,
      financialAccomplishment: 232000,
      physicalNotablePractice:
        "Cascaded invitations through district coordinators, which lifted attendance above target.",
      financialJustification:
        "Venue was provided in-house, reducing the projected rental cost.",
      participants: {
        create: [
          { personId: people.get("Jose Reyes")! },
          { personId: people.get("Ana Cruz")! },
        ],
      },
    },
  });

  await prisma.statusHistory.create({
    data: { activityId: conducted.id, fromStatus: "PLANNED", toStatus: "CONDUCTED" },
  });

  // PLANNED — deliberately overlaps the rescheduled activity below so the
  // date-conflict check has something to find during development.
  await prisma.activity.create({
    data: {
      title: "[SAMPLE] Learning Action Cell Orientation",
      programId: programs.get("Teaching Effectiveness"),
      startDate: d(2026, 10, 5),
      endDate: d(2026, 10, 6),
      venueId: venues.get("Conference Room A"),
      leadDivisionId: divisions.get("CID"),
      focalPersonId: people.get("Ana Cruz"),
      type: "LND",
      performanceIndicator: "No. of teachers oriented",
      hasFinancialReq: false,
      status: "PLANNED",
      participants: { create: [{ personId: people.get("Grace Lim")! }] },
    },
  });

  // RESCHEDULED — carries a catch-up plan row.
  const rescheduled = await prisma.activity.create({
    data: {
      title: "[SAMPLE] Records Management Workshop",
      programId: programs.get("Technical Skills Enhancement"),
      startDate: d(2026, 10, 5),
      endDate: d(2026, 10, 7),
      venueId: venues.get("Conference Room B"),
      leadDivisionId: divisions.get("ADMIN"),
      focalPersonId: people.get("Liza Mendoza"),
      type: "NON_LND",
      performanceIndicator: "No. of staff trained",
      hasFinancialReq: true,
      sourceOfFund: "MOOE",
      status: "RESCHEDULED",
      participants: { create: [{ personId: people.get("Ramon Dela Cruz")! }] },
    },
  });

  await prisma.rescheduleRecord.create({
    data: {
      activityId: rescheduled.id,
      reasonForPostponement: "Resource speaker unavailable due to a conflicting regional activity.",
      previousStartDate: d(2026, 10, 5),
      previousEndDate: d(2026, 10, 7),
      proposedStartDate: d(2026, 11, 9),
      proposedEndDate: d(2026, 11, 11),
    },
  });

  await prisma.statusHistory.create({
    data: { activityId: rescheduled.id, fromStatus: "PLANNED", toStatus: "RESCHEDULED" },
  });

  // DROPPED — archived, so it must not appear on the active calendar.
  const dropped = await prisma.activity.create({
    data: {
      title: "[SAMPLE] Financial Literacy Seminar",
      programId: programs.get("Values and Wellness"),
      startDate: d(2026, 9, 21),
      endDate: d(2026, 9, 21),
      venueId: venues.get("Multipurpose Hall"),
      leadDivisionId: divisions.get("FIN"),
      focalPersonId: people.get("Carlos Villanueva"),
      type: "NON_LND",
      hasFinancialReq: true,
      sourceOfFund: "PSF",
      status: "DROPPED",
      reasonForDropping: "Budget realigned to a higher-priority regional activity.",
      archivedAt: new Date(),
    },
  });

  await prisma.statusHistory.create({
    data: { activityId: dropped.id, fromStatus: "PLANNED", toStatus: "DROPPED" },
  });

  console.log("  activities: 4 samples (conducted, planned, rescheduled, dropped)");

  // --- Accounts -----------------------------------------------------------
  // Development credentials only. Change these before the system is used.
  const ACCOUNTS = [
    { email: "admin@example.gov.ph", name: "System Administrator", role: "ADMIN" as const, password: "admin1234" },
    { email: "manager@example.gov.ph", name: "Maria Santos", role: "PROGRAM_MANAGER" as const, password: "manager1234", person: "Maria Santos" },
    { email: "viewer@example.gov.ph", name: "Grace Lim", role: "VIEWER" as const, password: "viewer1234", person: "Grace Lim" },
  ];

  for (const acc of ACCOUNTS) {
    const passwordHash = await hash(acc.password, 10);
    await prisma.user.upsert({
      where: { email: acc.email },
      update: { name: acc.name, role: acc.role, passwordHash, isActive: true },
      create: {
        email: acc.email,
        name: acc.name,
        role: acc.role,
        passwordHash,
        personId: acc.person ? people.get(acc.person) : undefined,
      },
    });
  }
  console.log(`  accounts: ${ACCOUNTS.length}`);
  for (const a of ACCOUNTS) {
    console.log(`    ${a.role.padEnd(16)} ${a.email}  /  ${a.password}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

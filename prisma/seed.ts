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

  // PLANNED but already over — the "Awaiting a status" case. An activity
  // nobody closed out is the one state that is quietly wrong, so the
  // calendar has to have an example of it to render against.
  const overdue = await prisma.activity.create({
    data: {
      title: "[SAMPLE] Policy Orientation on Data Privacy",
      programId: programs.get("Policy Orientation"),
      startDate: d(2026, 9, 22),
      endDate: d(2026, 9, 23),
      venueId: venues.get("Online / MS Teams"),
      leadDivisionId: divisions.get("ADMIN"),
      focalPersonId: people.get("Ramon Dela Cruz"),
      type: "NON_LND",
      performanceIndicator: "No. of staff oriented",
      hasFinancialReq: false,
      status: "PLANNED",
      participants: { create: [{ personId: people.get("Liza Mendoza")! }] },
    },
  });

  // RESCHEDULED — carries a catch-up plan row.
  //
  // It sits at the dates of its LATEST postponement, because that is where
  // `rescheduleActivity` leaves an activity: the record is the history, the
  // activity's own dates are the present. Seeding it anywhere else would make
  // the catch-up plan's slip arithmetic read against data the app never
  // actually produces.
  const rescheduled = await prisma.activity.create({
    data: {
      title: "[SAMPLE] Records Management Workshop",
      programId: programs.get("Technical Skills Enhancement"),
      startDate: d(2026, 11, 9),
      endDate: d(2026, 11, 11),
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

  // Two postponements, so the timeline has a history to draw rather than a
  // single hop — the case the catch-up plan exists for.
  await prisma.rescheduleRecord.createMany({
    data: [
      {
        activityId: rescheduled.id,
        reasonForPostponement: "Multipurpose Hall was still under repair.",
        previousStartDate: d(2026, 8, 24),
        previousEndDate: d(2026, 8, 26),
        proposedStartDate: d(2026, 10, 5),
        proposedEndDate: d(2026, 10, 7),
      },
      {
        activityId: rescheduled.id,
        reasonForPostponement:
          "Resource speaker unavailable due to a conflicting regional activity.",
        previousStartDate: d(2026, 10, 5),
        previousEndDate: d(2026, 10, 7),
        proposedStartDate: d(2026, 11, 9),
        proposedEndDate: d(2026, 11, 11),
      },
    ],
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

  // A booking that was made over a known collision. These are not errors —
  // concurrent activities are sometimes intentional — so the system records
  // the decision rather than preventing it, and the calendar flags it.
  await prisma.conflictOverride.create({
    data: {
      activityId: overdue.id,
      kind: "DATE",
      details:
        "Records Management Workshop (ADMIN) also ran on Tue 22 Sep 2026.",
      conflictingActivityIds: [rescheduled.id],
    },
  });

  // Completion Report and MOVs for the conducted activity. `.invalid` is
  // reserved for exactly this: a URL that is unmistakably not a real upload.
  await prisma.attachment.createMany({
    data: [
      {
        activityId: conducted.id,
        kind: "COMPLETION_REPORT",
        fileName: "Completion Report — Instructional Leadership.pdf",
        url: "https://placeholder.invalid/sample-completion-report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_260_000,
      },
      {
        activityId: conducted.id,
        kind: "MOV",
        fileName: "Attendance sheets, Days 1–3.pdf",
        url: "https://placeholder.invalid/sample-attendance.pdf",
        mimeType: "application/pdf",
        sizeBytes: 3_410_000,
      },
      {
        activityId: conducted.id,
        kind: "MOV",
        fileName: "Session photos.zip",
        url: "https://placeholder.invalid/sample-photos.zip",
        mimeType: "application/zip",
        sizeBytes: 18_700_000,
      },
    ],
  });

  console.log(
    "  activities: 5 samples (conducted, planned, overdue, rescheduled, dropped)",
  );
  console.log("  + 1 conflict override, 3 attachments");

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

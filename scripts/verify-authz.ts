import { createRequire } from "node:module";

import "dotenv/config";

/**
 * Authorization checks against the real database.
 *
 * The question these answer is not "does the button disappear" — it is whether
 * the rules themselves hold. Hiding a control is presentation; the Server
 * Actions are reachable by direct POST regardless of what the page renders.
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

async function main() {
  const { prisma } = await import("@/lib/db");
  const { canManageActivities, canManageAccounts } = await import("@/lib/authz");
  const { compare } = await import("bcryptjs");

  console.log("\n=== Who may create or change activities ===");
  check("ADMIN may", canManageActivities("ADMIN"), true);
  check("PROGRAM_MANAGER may", canManageActivities("PROGRAM_MANAGER"), true);
  check("VIEWER may NOT", canManageActivities("VIEWER"), false);
  check("a signed-out user may NOT", canManageActivities(undefined), false);
  check("a null role may NOT", canManageActivities(null), false);

  console.log("\n=== Who may manage accounts ===");
  check("ADMIN may", canManageAccounts("ADMIN"), true);
  check("PROGRAM_MANAGER may NOT", canManageAccounts("PROGRAM_MANAGER"), false);
  check("VIEWER may NOT", canManageAccounts("VIEWER"), false);

  console.log("\n=== Seeded accounts ===");
  const users = await prisma.user.findMany({
    select: { email: true, role: true, passwordHash: true, isActive: true },
    orderBy: { email: "asc" },
  });
  check("three accounts exist", users.length, 3);
  check("every account has a password hash", users.every((u) => Boolean(u.passwordHash)), true);
  check(
    "no password is stored in plain text",
    users.every((u) => u.passwordHash?.startsWith("$2")),
    true,
  );
  check("all are active", users.every((u) => u.isActive), true);

  console.log("\n=== Password verification ===");
  const mgr = users.find((u) => u.role === "PROGRAM_MANAGER")!;
  check("correct password verifies", await compare("manager1234", mgr.passwordHash!), true);
  check("wrong password rejects", await compare("wrongpassword", mgr.passwordHash!), false);
  check("empty password rejects", await compare("", mgr.passwordHash!), false);

  console.log("\n=== Role distribution matches the office rule ===");
  const byRole = Object.fromEntries(
    (["ADMIN", "PROGRAM_MANAGER", "VIEWER"] as const).map((r) => [
      r,
      users.filter((u) => u.role === r).length,
    ]),
  );
  check("one program manager", byRole.PROGRAM_MANAGER, 1);
  check("one viewer", byRole.VIEWER, 1);

  console.log("\n=== New accounts default to least privilege ===");
  const def = await prisma.$queryRawUnsafe<{ column_default: string }[]>(
    `SELECT column_default FROM information_schema.columns
     WHERE table_name='users' AND column_name='role'`,
  );
  check(
    "database default is VIEWER",
    def[0]?.column_default?.includes("VIEWER"),
    true,
  );

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} FAILED\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main();

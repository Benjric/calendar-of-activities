import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma singleton.
 *
 * Prisma 7 requires an explicit driver adapter — the bundled query engine is
 * gone. `@prisma/adapter-pg` also happens to be what makes this work on Vercel,
 * where a serverless function cannot keep a long-lived engine process alive.
 *
 * Next.js dev-mode hot reload re-evaluates modules on every edit. Without
 * caching the client on `globalThis`, each reload opens a fresh connection pool
 * and Postgres runs out of connections within a few minutes of editing.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

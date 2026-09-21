"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

import { AuthorizationError, requireAdminAction } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  createAccountSchema,
  resetPasswordSchema,
  setAccountActiveSchema,
  updateAccountSchema,
} from "@/lib/validation";

/**
 * Account management.
 *
 * Administrator-only, and re-checked here rather than trusted from the page:
 * a Server Function is reachable by direct POST, so the page that hides these
 * controls is presentation, not access control.
 *
 * Three invariants hold no matter who asks:
 *   1. Nobody edits their own role or active flag — a mistake there locks the
 *      person making it out of the screen that could undo it.
 *   2. The last active Administrator cannot be demoted or deactivated, or the
 *      office loses account management entirely with no way back in.
 *   3. Passwords are bcrypt-hashed before they touch the database, and hashes
 *      are never read back out to the client.
 */

export interface AccountActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  userId?: string;
}

/** bcrypt cost. Matches the seed script so seeded and created logins agree. */
const BCRYPT_ROUNDS = 10;

function fieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}

/** Turns an unauthorized call into a clean result instead of a server crash. */
async function guard(
  fn: (adminId: string) => Promise<AccountActionResult>,
): Promise<AccountActionResult> {
  try {
    const admin = await requireAdminAction();
    return await fn(admin.id);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Prisma raises P2002 on a unique violation and names the offending column. */
function uniqueViolation(e: unknown): string | null {
  if (typeof e !== "object" || e === null) return null;
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err.code !== "P2002") return null;

  const target = Array.isArray(err.meta?.target)
    ? err.meta.target.map(String)
    : typeof err.meta?.target === "string"
      ? [err.meta.target]
      : [];

  if (target.some((t) => t.includes("email"))) return "email";
  if (target.some((t) => t.includes("person"))) return "personId";
  return "_";
}

const DUPLICATE_MESSAGE: Record<string, string> = {
  email: "That email already has an account",
  personId: "That employee is already linked to another account",
  _: "Those details are already in use",
};

/**
 * Guards invariant 2. Counts the OTHER active Administrators, so the caller can
 * refuse a change that would leave none.
 */
async function otherActiveAdminCount(excludeUserId: string) {
  return prisma.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: excludeUserId } },
  });
}

export async function createAccount(raw: unknown): Promise<AccountActionResult> {
  return guard(async () => {
    const parsed = createAccountSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

    const { name, email, password, role, divisionId, personId } = parsed.data;

    try {
      const created = await prisma.user.create({
        data: {
          name,
          email,
          role,
          divisionId: divisionId ?? null,
          personId: personId ?? null,
          passwordHash: await hash(password, BCRYPT_ROUNDS),
          isActive: true,
        },
        select: { id: true },
      });

      revalidatePath("/accounts");
      return { ok: true, userId: created.id, message: `Account created for ${email}.` };
    } catch (e) {
      const field = uniqueViolation(e);
      if (field) return { ok: false, errors: { [field]: DUPLICATE_MESSAGE[field] } };
      throw e;
    }
  });
}

export async function updateAccount(raw: unknown): Promise<AccountActionResult> {
  return guard(async (adminId) => {
    const parsed = updateAccountSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

    const { userId, name, email, role, divisionId, personId } = parsed.data;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    if (!target) return { ok: false, message: "That account no longer exists." };

    const roleChanged = target.role !== role;

    if (roleChanged && userId === adminId) {
      return {
        ok: false,
        errors: {
          role: "You cannot change your own role. Ask another Administrator.",
        },
      };
    }

    if (roleChanged && target.role === "ADMIN") {
      const others = await otherActiveAdminCount(userId);
      if (others === 0) {
        return {
          ok: false,
          errors: {
            role: "This is the last active Administrator. Promote someone else first.",
          },
        };
      }
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          name,
          email,
          role,
          divisionId: divisionId ?? null,
          personId: personId ?? null,
        },
      });

      revalidatePath("/accounts");
      return { ok: true, userId, message: "Account updated." };
    } catch (e) {
      const field = uniqueViolation(e);
      if (field) return { ok: false, errors: { [field]: DUPLICATE_MESSAGE[field] } };
      throw e;
    }
  });
}

/**
 * Deactivation rather than deletion. A user row is referenced by status
 * history, conflict overrides and reschedule records — deleting it would erase
 * who made those decisions. `isActive: false` blocks sign-in (see `authorize`
 * in `src/auth.ts`) and drops any live session on its next request.
 */
export async function setAccountActive(raw: unknown): Promise<AccountActionResult> {
  return guard(async (adminId) => {
    const parsed = setAccountActiveSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

    const { userId, isActive } = parsed.data;

    if (!isActive && userId === adminId) {
      return { ok: false, message: "You cannot deactivate your own account." };
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });
    if (!target) return { ok: false, message: "That account no longer exists." };

    if (!isActive && target.role === "ADMIN") {
      const others = await otherActiveAdminCount(userId);
      if (others === 0) {
        return {
          ok: false,
          message:
            "This is the last active Administrator. Promote someone else first.",
        };
      }
    }

    await prisma.user.update({ where: { id: userId }, data: { isActive } });

    revalidatePath("/accounts");
    return {
      ok: true,
      userId,
      message: isActive
        ? `${target.email} can sign in again.`
        : `${target.email} can no longer sign in.`,
    };
  });
}

/**
 * Sets a new password directly. A field office needs to hand someone a working
 * login at the desk without a mail server in the loop.
 */
export async function resetAccountPassword(
  raw: unknown,
): Promise<AccountActionResult> {
  return guard(async () => {
    const parsed = resetPasswordSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

    const { userId, password } = parsed.data;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!target) return { ok: false, message: "That account no longer exists." };

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(password, BCRYPT_ROUNDS) },
    });

    revalidatePath("/accounts");
    return { ok: true, userId, message: `Password set for ${target.email}.` };
  });
}

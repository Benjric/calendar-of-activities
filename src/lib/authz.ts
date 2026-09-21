import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Authorization.
 *
 * Two capabilities, from the office's own rule: Program Managers create and
 * change activities; everyone else reads the Calendar and the Catch-up Plan.
 *
 * These checks run on the SERVER in every mutation. Server Functions are
 * reachable by direct POST, not only through the UI, so hiding a button is
 * presentation — it is not access control.
 */

/** Roles allowed to create or modify activities. */
const WRITERS: UserRole[] = ["ADMIN", "PROGRAM_MANAGER"];

/** Routes a VIEWER may open. Everything else is for writers. */
export const VIEWER_ROUTES = ["/calendar", "/catch-up"] as const;

export function canManageActivities(role: UserRole | undefined | null): boolean {
  return role ? WRITERS.includes(role) : false;
}

export function canManageAccounts(role: UserRole | undefined | null): boolean {
  return role === "ADMIN";
}

export async function getSession() {
  return auth();
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** For pages: redirects to sign-in when there is no session. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** For pages: sends a Viewer back to the calendar rather than showing a 403. */
export async function requireManagerPage() {
  const user = await requireUser();
  if (!canManageActivities(user.role)) redirect("/calendar?denied=1");
  return user;
}

/** For pages: account management is Administrator-only. */
export async function requireAdminPage() {
  const user = await requireUser();
  if (!canManageAccounts(user.role)) redirect("/calendar?denied=1");
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * For Server Actions. Throws rather than redirects — an action invoked by a
 * direct POST must fail, not bounce to a page.
 */
export async function requireManagerAction() {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("You must be signed in.");
  if (!canManageActivities(user.role)) {
    throw new AuthorizationError(
      "Only Program Managers can create or change activities.",
    );
  }
  return user;
}

/** For Server Actions that touch accounts. Throws rather than redirects. */
export async function requireAdminAction() {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("You must be signed in.");
  if (!canManageAccounts(user.role)) {
    throw new AuthorizationError("Only Administrators can manage accounts.");
  }
  return user;
}

/**
 * Re-exported so server code can keep reaching role wording through `authz`.
 * The definitions live in `format.ts`, which the browser can also import.
 */
export { ROLE_LABEL, ROLE_DESCRIPTION } from "@/lib/format";

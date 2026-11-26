"use server";

import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/authz";
import { seenCookieName } from "@/lib/notifications";

/** Marks every notification up to now as read, for this user in this browser. */
export async function markNotificationsSeen(): Promise<void> {
  const user = await getCurrentUser();
  if (!user?.id) return;

  const store = await cookies();
  store.set(seenCookieName(user.id), new Date().toISOString(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

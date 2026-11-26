import type { Metadata } from "next";
import { Lexend, Source_Sans_3 } from "next/font/google";
import Link from "next/link";

import { NavLinks } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { UserMenu } from "@/components/user-menu";
import {
  canManageAccounts,
  canManageActivities,
  getCurrentUser,
  ROLE_LABEL,
} from "@/lib/authz";
import { formatDateRange } from "@/lib/format";
import { getBookingNotifications } from "@/lib/notifications";
import { countWithOverrides } from "@/lib/queries";

import "./globals.css";

/*
 * Two faces, from the redesign: Lexend for headings and figures, Source Sans 3
 * for everything read as prose. Figures take tabular numerals, not a mono face.
 */
const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const heading = Lexend({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Calendar of Activities",
  description:
    "Book activities, detect date, venue and participant conflicts, and report accomplishment against target.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const canManage = canManageActivities(user?.role);
  const canAdminister = canManageAccounts(user?.role);
  const conflictCount = canManage ? await countWithOverrides() : 0;
  const notifications = user?.id
    ? await getBookingNotifications(user.id)
    : { items: [], unread: 0 };
  const bellItems = notifications.items.map((n) => ({
    id: n.id,
    title: n.title,
    dates: formatDateRange(n.startDate, n.endDate),
    when: ago(n.createdAt),
    by: n.by,
    unread: n.unread,
  }));

  return (
    <html
      lang="en"
      className={`${sans.variable} ${heading.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {user && (
          <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
            <div className="mx-auto flex min-h-16 max-w-[1520px] flex-wrap items-center gap-x-6 gap-y-1 px-4 sm:px-7">
              <Link
                href="/calendar"
                className="flex items-center gap-2.5"
                aria-label="Calendar of Activities, home"
              >
                <span
                  aria-hidden="true"
                  className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-primary text-primary-foreground"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                </span>
                <span className="font-heading text-base font-semibold">
                  Calendar of Activities
                </span>
              </Link>

              <NavLinks
                canManage={canManage}
                canManageAccounts={canAdminister}
                conflictCount={conflictCount}
              />

              <div className="ml-auto flex items-center gap-2.5 py-2">
                {canManage && (
                  <Link href="/activities/new" className="btn-primary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="size-4">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Book activity
                  </Link>
                )}

                <NotificationBell
                  key={`${notifications.unread}-${bellItems[0]?.id ?? ""}`}
                  items={bellItems}
                  unread={notifications.unread}
                />

                <UserMenu
                  name={user.name ?? user.email ?? "User"}
                  email={user.email ?? ""}
                  roleLabel={ROLE_LABEL[user.role]}
                />
              </div>
            </div>
          </header>
        )}

        {/*
          Signed-out pages (landing, sign-in) are full-bleed and bring their own
          chrome. Constraining them to the app's centered content column leaves
          page background showing at the edges on wide screens.
        */}
        {user ? (
          <main className="mx-auto flex w-full max-w-[1520px] flex-1 flex-col px-4 py-7 sm:px-7">
            {children}
          </main>
        ) : (
          <main className="flex flex-1 flex-col">{children}</main>
        )}

        {user && (
          <footer className="mt-auto border-t border-[var(--grid-line)]">
            <div className="mx-auto max-w-[1520px] px-4 py-4 text-xs text-muted-foreground sm:px-7">
              Development data. Divisions, venues and people are placeholders —
              replace them with the real office lists before use.
            </div>
          </footer>
        )}
      </body>
    </html>
  );
}

/** "Just now", "12 min ago", "3 h ago", "2 days ago". */
function ago(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

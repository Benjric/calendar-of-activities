import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import { NavLinks } from "@/components/nav-links";
import { UserMenu } from "@/components/user-menu";
import {
  canManageAccounts,
  canManageActivities,
  getCurrentUser,
  ROLE_LABEL,
} from "@/lib/authz";

import "./globals.css";

const sans = Archivo({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {user && (
          <header className="sticky top-0 z-30 border-b border-[var(--grid-line)] bg-card/85 backdrop-blur-sm">
            <div className="mx-auto flex max-w-[1520px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-2.5 sm:px-6">
              <Link href="/calendar" className="flex items-center gap-2.5" aria-label="Calendar of Activities, home">
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                </span>
                <span className="flex flex-col leading-none">
                  <span className="text-[15px] font-semibold tracking-tight">
                    Calendar of Activities
                  </span>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">
                    Learning &amp; Development
                  </span>
                </span>
              </Link>

              <div className="hidden h-6 w-px bg-[var(--grid-line)] sm:block" />

              <NavLinks
                canManage={canManage}
                canManageAccounts={canAdminister}
              />

              <div className="ml-auto flex items-center gap-2">
                {canManage && (
                  <Link
                    href="/activities/new"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-[0_1px_2px_-1px_oklch(0.21_0.02_260/0.3)] transition-[opacity,transform] hover:opacity-92 active:translate-y-px"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true" className="size-4">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Book an Activity
                  </Link>
                )}

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
          page background showing at the edges on wide screens — negative
          margins can cancel the padding but never the centering gutters.
        */}
        {user ? (
          <main className="mx-auto flex w-full max-w-[1520px] flex-1 flex-col px-4 py-6 sm:px-6">
            {children}
          </main>
        ) : (
          <main className="flex flex-1 flex-col">{children}</main>
        )}

        {user && (
          <footer className="mt-auto border-t border-[var(--grid-line)]">
            <div className="mx-auto max-w-[1520px] px-4 py-4 text-xs text-muted-foreground sm:px-6">
              Development data. Divisions, venues and people are placeholders —
              replace them with the real office lists before use.
            </div>
          </footer>
        )}
      </body>
    </html>
  );
}

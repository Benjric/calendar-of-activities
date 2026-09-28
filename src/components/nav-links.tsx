"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Routes a Viewer may open. Managers see everything. */
const VIEWER_NAV = [
  { href: "/calendar", label: "Calendar" },
  { href: "/catch-up", label: "Catch-up Plan" },
];

const MANAGER_NAV = [
  { href: "/calendar", label: "Calendar" },
  { href: "/activities", label: "Register" },
  { href: "/conflicts", label: "Conflicts" },
  { href: "/catch-up", label: "Catch-up Plan" },
  { href: "/archive", label: "Archive" },
];

/** Administrators only. Appended so the shared tabs keep their order. */
const ADMIN_NAV = [{ href: "/accounts", label: "Accounts" }];

export function NavLinks({
  canManage,
  canManageAccounts,
}: {
  canManage: boolean;
  canManageAccounts: boolean;
}) {
  const pathname = usePathname();
  const items = [
    ...(canManage ? MANAGER_NAV : VIEWER_NAV),
    ...(canManageAccounts ? ADMIN_NAV : []),
  ];

  return (
    <nav aria-label="Primary" className="flex flex-wrap items-center gap-1 text-sm">
      {items.map((item) => {
        const active =
          item.href === "/calendar"
            ? pathname === "/calendar" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            /*
              The active tab is marked by a rule under the label rather than a
              filled pill: the header already carries a filled primary button,
              and a second filled shape competes with it for the same attention.
            */
            className={`flex h-11 items-center border-b-2 px-3.5 transition-colors ${
              active
                ? "border-primary font-semibold text-foreground"
                : "border-transparent font-medium text-[var(--body-muted)] hover:border-input hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

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
  conflictCount = 0,
}: {
  canManage: boolean;
  canManageAccounts: boolean;
  conflictCount?: number;
}) {
  const pathname = usePathname();
  const items = [
    ...(canManage ? MANAGER_NAV : VIEWER_NAV),
    ...(canManageAccounts ? ADMIN_NAV : []),
  ];

  return (
    <nav
      aria-label="Primary"
      className="-mb-px flex flex-1 flex-wrap items-stretch gap-0.5 text-[15px]"
    >
      {items.map((item) => {
        const active =
          item.href === "/calendar"
            ? pathname === "/calendar"
            : item.href === "/activities"
              ? pathname === "/activities"
              : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            /*
              The active tab is a rule under the label rather than a filled
              pill: the header already carries a filled primary button, and a
              second filled shape competes with it.
            */
            className={`flex min-h-16 items-center gap-1.5 border-b-2 px-3.5 transition-[color,border-color] duration-200 ${
              active
                ? "border-primary font-semibold text-foreground"
                : "border-transparent font-medium text-muted-foreground hover:border-input hover:text-foreground"
            }`}
          >
            {item.label}
            {item.href === "/conflicts" && conflictCount > 0 && (
              <span
                aria-label={`${conflictCount} booked over a conflict`}
                className="anim-spring inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--conflict-bg)] px-1.5 text-xs font-bold text-[var(--conflict-text)]"
              >
                {conflictCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

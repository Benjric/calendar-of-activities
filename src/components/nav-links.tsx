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
    <nav className="flex flex-wrap items-center gap-0.5 text-sm">
      {items.map((item) => {
        const active =
          item.href === "/calendar"
            ? pathname === "/calendar" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

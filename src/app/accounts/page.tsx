import { AccountManager, type AccountRow } from "@/components/account-manager";
import { requireAdminPage } from "@/lib/authz";
import { getAccountLookups, listAccounts } from "@/lib/queries";

/**
 * Accounts — Administrator only.
 *
 * `requireAdminPage` sends anyone else back to the calendar. It is not the only
 * guard: `proxy.ts` keeps signed-out visitors off this route, and each Server
 * Action re-checks the role, since a form post never has to come from a page.
 */
export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const admin = await requireAdminPage();

  const [accounts, lookups] = await Promise.all([
    listAccounts(),
    getAccountLookups(),
  ]);

  // Flattened here rather than in the Client Component: `Date` and nested
  // relations are needlessly heavy to hand across the boundary.
  const rows: AccountRow[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
    divisionId: a.divisionId,
    personId: a.personId,
    divisionLabel: a.division
      ? (a.division.acronym ?? a.division.name)
      : null,
    personLabel: a.person?.fullName ?? null,
  }));

  return (
    <AccountManager accounts={rows} lookups={lookups} currentUserId={admin.id} />
  );
}

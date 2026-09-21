"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, useTransition } from "react";

import {
  createAccount,
  resetAccountPassword,
  setAccountActive,
  updateAccount,
} from "@/lib/account-actions";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/format";

/**
 * The accounts screen.
 *
 * Every rule enforced here is enforced again in the Server Actions. Disabling a
 * control is a courtesy to the person using the screen — it is not what keeps
 * the last Administrator from deleting their own access.
 */

type Role = "ADMIN" | "PROGRAM_MANAGER" | "VIEWER";

export interface AccountRow {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  divisionId: string | null;
  personId: string | null;
  divisionLabel: string | null;
  personLabel: string | null;
}

interface Lookups {
  divisions: { id: string; name: string; acronym: string | null }[];
  people: { id: string; fullName: string; takenBy: string | null }[];
}

interface Props {
  accounts: AccountRow[];
  lookups: Lookups;
  /** The signed-in Administrator, so the screen can mark and protect their row. */
  currentUserId: string;
}

const ROLES: Role[] = ["ADMIN", "PROGRAM_MANAGER", "VIEWER"];

/** How long a confirmation banner stays up, and how long it takes to fade. */
const NOTICE_MS = 5000;
const FADE_MS = 400;

const ROLE_STYLE: Record<Role, string> = {
  ADMIN: "border-primary/35 bg-primary/10 text-primary",
  PROGRAM_MANAGER:
    "border-[var(--status-conducted)]/35 bg-[var(--status-conducted-bg)] text-[var(--status-conducted)]",
  VIEWER: "border-[var(--grid-line)] bg-accent/50 text-muted-foreground",
};

const inputCls =
  "w-full rounded-lg border border-[var(--grid-line)] bg-card px-3 py-2 text-sm transition-[border-color] focus:border-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1";

function errorCls(hasError: boolean) {
  return hasError ? `${inputCls} border-[var(--conflict)]` : inputCls;
}

/** Blank form state for the "New account" panel. */
const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "VIEWER" as Role,
  divisionId: "",
  personId: "",
};

type Panel =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "edit"; id: string }
  | { kind: "password"; id: string };

export function AccountManager({ accounts, lookups, currentUserId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [noticeLeaving, setNoticeLeaving] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [password, setPassword] = useState("");

  /**
   * Confirmations are transient — the table underneath already shows the new
   * state, so a banner that sat there forever would just make stale claims
   * about edits the user has moved on from. It fades out shortly before it
   * unmounts, so it never vanishes mid-blink.
   *
   * Failures stay put. A refusal explains something the user has to act on,
   * and timing it out would hide the reason their change did not take.
   */
  useEffect(() => {
    if (!notice?.ok) return;

    const fade = setTimeout(() => setNoticeLeaving(true), NOTICE_MS - FADE_MS);
    const clear = setTimeout(() => setNotice(null), NOTICE_MS);

    return () => {
      clearTimeout(fade);
      clearTimeout(clear);
    };
  }, [notice]);

  const activeAdmins = accounts.filter((a) => a.role === "ADMIN" && a.isActive);
  const lastActiveAdminId =
    activeAdmins.length === 1 ? activeAdmins[0].id : null;

  /** Raising a banner also restarts its fade, so a new one is never born dim. */
  function showNotice(ok: boolean, text: string) {
    setNoticeLeaving(false);
    setNotice({ ok, text });
  }

  function closePanel() {
    setPanel({ kind: "none" });
    setErrors({});
    setForm(EMPTY_FORM);
    setPassword("");
  }

  function openNew() {
    setErrors({});
    setNotice(null);
    setForm(EMPTY_FORM);
    setPanel({ kind: "new" });
  }

  function openEdit(account: AccountRow) {
    setErrors({});
    setNotice(null);
    setForm({
      name: account.name ?? "",
      email: account.email,
      password: "",
      role: account.role,
      divisionId: account.divisionId ?? "",
      personId: account.personId ?? "",
    });
    setPanel({ kind: "edit", id: account.id });
  }

  function openPassword(account: AccountRow) {
    setErrors({});
    setNotice(null);
    setPassword("");
    setPanel({ kind: "password", id: account.id });
  }

  const set = (k: keyof typeof EMPTY_FORM, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  function handleCreate() {
    setErrors({});
    startTransition(async () => {
      const r = await createAccount(form);
      if (r.ok) {
        closePanel();
        showNotice(true, r.message ?? "Account created.");
        router.refresh();
        return;
      }
      if (r.errors) setErrors(r.errors);
      if (r.message) showNotice(false, r.message);
    });
  }

  function handleUpdate(userId: string) {
    setErrors({});
    startTransition(async () => {
      const r = await updateAccount({
        userId,
        name: form.name,
        email: form.email,
        role: form.role,
        divisionId: form.divisionId,
        personId: form.personId,
      });
      if (r.ok) {
        closePanel();
        showNotice(true, r.message ?? "Account updated.");
        router.refresh();
        return;
      }
      if (r.errors) setErrors(r.errors);
      if (r.message) showNotice(false, r.message);
    });
  }

  function handleResetPassword(userId: string) {
    setErrors({});
    startTransition(async () => {
      const r = await resetAccountPassword({ userId, password });
      if (r.ok) {
        closePanel();
        showNotice(true, r.message ?? "Password set.");
        router.refresh();
        return;
      }
      if (r.errors) setErrors(r.errors);
      if (r.message) showNotice(false, r.message);
    });
  }

  function handleToggleActive(account: AccountRow) {
    setNotice(null);
    startTransition(async () => {
      const r = await setAccountActive({
        userId: account.id,
        isActive: !account.isActive,
      });
      showNotice(
        r.ok,
        r.message ?? (r.ok ? "Account updated." : "That did not work."),
      );
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] leading-none font-semibold tracking-tight">
            Accounts
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Who can sign in, and what each of them may do. Accounts are
            deactivated rather than deleted, so the record of who booked or
            changed an activity stays intact.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-[0_1px_2px_-1px_oklch(0.21_0.02_260/0.3)] transition-[opacity,transform] hover:opacity-92 active:translate-y-px"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            aria-hidden="true"
            className="size-4"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New account
        </button>
      </div>

      {notice && (
        <p
          role="status"
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200 ${
            noticeLeaving
              ? "motion-safe:animate-out motion-safe:fade-out motion-safe:fill-mode-forwards motion-safe:duration-400"
              : ""
          } ${
            notice.ok
              ? "border-[var(--status-conducted)]/35 bg-[var(--status-conducted-bg)] text-[var(--status-conducted)]"
              : "border-[var(--conflict)]/35 bg-[var(--conflict-bg)] text-[var(--conflict)]"
          }`}
        >
          <span className="flex-1">{notice.text}</span>
          {/* An error worth reading should not time out from under the reader. */}
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="-my-1 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              aria-hidden="true"
              className="size-3.5"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </p>
      )}

      {panel.kind === "new" && (
        <div className="surface p-4">
          <h2 className="text-sm font-semibold">New account</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            The password you set here is what you hand to the person. They can
            sign in with it immediately.
          </p>

          <div className="mt-4 space-y-4">
            <AccountFields
              form={form}
              set={set}
              errors={errors}
              lookups={lookups}
              showPassword
            />
            <PanelActions
              pending={pending}
              onCancel={closePanel}
              onSubmit={handleCreate}
              label="Create account"
            />
          </div>
        </div>
      )}

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-[var(--grid-line)] text-left">
              {["Name", "Email", "Role", "Division", "Employee record", "Status", ""].map(
                (h, i) => (
                  <th
                    key={h || `sp-${i}`}
                    className="px-3 py-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--grid-line)]">
            {accounts.map((a) => {
              const isSelf = a.id === currentUserId;
              const isLastAdmin = a.id === lastActiveAdminId;
              const editing = panel.kind === "edit" && panel.id === a.id;
              const resetting = panel.kind === "password" && panel.id === a.id;

              return (
                // The editor renders as a second row so it stays visually
                // attached to the account it edits.
                <Fragment key={a.id}>
                  <tr
                    className={`transition-colors hover:bg-accent/40 ${
                      a.isActive ? "" : "opacity-60"
                    }`}
                  >
                    <td className="px-3 py-2.5 font-medium">
                      {a.name ?? "—"}
                      {isSelf && (
                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[13px] text-muted-foreground">
                      {a.email}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        title={ROLE_DESCRIPTION[a.role]}
                        className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${ROLE_STYLE[a.role]}`}
                      >
                        {ROLE_LABEL[a.role]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {a.divisionLabel ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {a.personLabel ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[13px] ${
                          a.isActive
                            ? "text-[var(--status-conducted)]"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${
                            a.isActive
                              ? "bg-[var(--status-conducted)]"
                              : "bg-muted-foreground"
                          }`}
                        />
                        {a.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <RowButton onClick={() => openEdit(a)} disabled={pending}>
                          Edit
                        </RowButton>
                        <RowButton
                          onClick={() => openPassword(a)}
                          disabled={pending}
                        >
                          Reset password
                        </RowButton>
                        <RowButton
                          onClick={() => handleToggleActive(a)}
                          disabled={pending || isSelf || (a.isActive && isLastAdmin)}
                          destructive={a.isActive}
                          title={
                            isSelf
                              ? "You cannot deactivate your own account"
                              : a.isActive && isLastAdmin
                                ? "This is the last active Administrator"
                                : undefined
                          }
                        >
                          {a.isActive ? "Deactivate" : "Reactivate"}
                        </RowButton>
                      </div>
                    </td>
                  </tr>

                  {editing && (
                    <tr>
                      <td colSpan={7} className="bg-accent/30 px-3 py-4">
                        <h3 className="text-sm font-semibold">
                          Edit {a.name ?? a.email}
                        </h3>
                        <div className="mt-3 space-y-4">
                          <AccountFields
                            form={form}
                            set={set}
                            errors={errors}
                            lookups={lookups}
                            currentPersonId={a.personId}
                            roleLocked={isSelf}
                            roleLockReason={
                              isSelf
                                ? "You cannot change your own role. Ask another Administrator."
                                : undefined
                            }
                          />
                          <PanelActions
                            pending={pending}
                            onCancel={closePanel}
                            onSubmit={() => handleUpdate(a.id)}
                            label="Save changes"
                          />
                        </div>
                      </td>
                    </tr>
                  )}

                  {resetting && (
                    <tr>
                      <td colSpan={7} className="bg-accent/30 px-3 py-4">
                        <h3 className="text-sm font-semibold">
                          Set a new password for {a.name ?? a.email}
                        </h3>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          The old password stops working the moment this is
                          saved. Any session they have open ends on its next
                          request.
                        </p>
                        <div className="mt-3 max-w-sm space-y-4">
                          <label className="block">
                            <span className="mb-1.5 block text-sm font-medium">
                              New password
                            </span>
                            <input
                              type="text"
                              value={password}
                              autoComplete="off"
                              onChange={(e) => setPassword(e.currentTarget.value)}
                              className={errorCls(Boolean(errors.password))}
                            />
                            <FieldError message={errors.password} />
                            <span className="mt-1 block text-[12px] text-muted-foreground">
                              Shown in plain text so you can read it out.
                            </span>
                          </label>
                          <PanelActions
                            pending={pending}
                            onCancel={closePanel}
                            onSubmit={() => handleResetPassword(a.id)}
                            label="Set password"
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountFields({
  form,
  set,
  errors,
  lookups,
  showPassword,
  currentPersonId,
  roleLocked,
  roleLockReason,
}: {
  form: typeof EMPTY_FORM;
  set: (k: keyof typeof EMPTY_FORM, v: string) => void;
  errors: Record<string, string>;
  lookups: Lookups;
  showPassword?: boolean;
  /** The person this account already links to, which stays selectable. */
  currentPersonId?: string | null;
  roleLocked?: boolean;
  roleLockReason?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Name<span className="ml-0.5 text-[var(--conflict)]">*</span>
        </span>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.currentTarget.value)}
          className={errorCls(Boolean(errors.name))}
        />
        <FieldError message={errors.name} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Email<span className="ml-0.5 text-[var(--conflict)]">*</span>
        </span>
        <input
          type="email"
          value={form.email}
          autoComplete="off"
          onChange={(e) => set("email", e.currentTarget.value)}
          className={errorCls(Boolean(errors.email))}
        />
        <FieldError message={errors.email} />
      </label>

      {showPassword && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Password<span className="ml-0.5 text-[var(--conflict)]">*</span>
          </span>
          <input
            type="text"
            value={form.password}
            autoComplete="off"
            onChange={(e) => set("password", e.currentTarget.value)}
            className={errorCls(Boolean(errors.password))}
          />
          <FieldError message={errors.password} />
          <span className="mt-1 block text-[12px] text-muted-foreground">
            At least 8 characters.
          </span>
        </label>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Role</span>
        <select
          value={form.role}
          disabled={roleLocked}
          onChange={(e) => set("role", e.currentTarget.value)}
          className={`${errorCls(Boolean(errors.role))} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <FieldError message={errors.role} />
        <span className="mt-1 block text-[12px] text-muted-foreground">
          {roleLockReason ?? ROLE_DESCRIPTION[form.role]}
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Division</span>
        <select
          value={form.divisionId}
          onChange={(e) => set("divisionId", e.currentTarget.value)}
          className={inputCls}
        >
          <option value="">— None —</option>
          {lookups.divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.acronym ? `${d.acronym} — ${d.name}` : d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Employee record</span>
        <select
          value={form.personId}
          onChange={(e) => set("personId", e.currentTarget.value)}
          className={errorCls(Boolean(errors.personId))}
        >
          <option value="">— Not linked —</option>
          {lookups.people.map((p) => {
            // One person, one login. A record already claimed by a different
            // account is shown but cannot be picked.
            const taken = p.takenBy !== null && p.id !== currentPersonId;
            return (
              <option key={p.id} value={p.id} disabled={taken}>
                {p.fullName}
                {taken ? " (has an account)" : ""}
              </option>
            );
          })}
        </select>
        <FieldError message={errors.personId} />
        <span className="mt-1 block text-[12px] text-muted-foreground">
          Links this login to the employee it belongs to.
        </span>
      </label>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="mt-1 block text-[12px] text-[var(--conflict)]">
      {message}
    </span>
  );
}

function PanelActions({
  pending,
  onCancel,
  onSubmit,
  label,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 sm:col-span-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-[var(--grid-line)] bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        className="ml-auto rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}

function RowButton({
  children,
  onClick,
  disabled,
  destructive,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md border px-2 py-1 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        destructive
          ? "border-[var(--conflict)]/35 text-[var(--conflict)] hover:bg-[var(--conflict-bg)]"
          : "border-[var(--grid-line)] text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

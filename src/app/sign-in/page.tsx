import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/sign-in-form";
import { getCurrentUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const POINTS = [
  {
    title: "Three checks before the save",
    body: "Date, venue and participants, run against the live calendar as you book.",
  },
  {
    title: "Target against accomplishment",
    body: "Physical and financial variance computed separately on the same record.",
  },
  {
    title: "Nothing quietly disappears",
    body: "Every postponement keeps its reason. Dropped activities stay in the archive.",
  },
];

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const user = await getCurrentUser();
  if (user) redirect("/calendar");

  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/calendar";

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-primary px-10 py-12 text-white lg:flex lg:flex-col">
        {/* A faint calendar grid, echoing the product itself. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "88px 72px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-white/5 blur-3xl"
        />

        <Link href="/" className="relative flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15 backdrop-blur-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4.5">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">
              Calendar of Activities
            </span>
            <span className="mt-0.5 text-[11px] text-white/60">
              Learning &amp; Development
            </span>
          </span>
        </Link>

        <div className="relative mt-auto max-w-[46ch]">
          <h2 className="text-[30px] leading-[1.15] font-semibold tracking-tight">
            The clash is caught when you book it, not on the day it happens.
          </h2>

          <ul className="mt-8 space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/50"
                />
                <span>
                  <span className="block text-sm font-medium">{p.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-white/60">
                    {p.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-auto pt-10 text-[11px] text-white/40">
          Accounts are issued by your administrator.
        </p>
      </section>

      {/* Form panel */}
      <section className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-[380px]">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </Link>

          <span
            aria-hidden="true"
            className="mt-4 grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </span>

          <h1 className="mt-5 text-[26px] leading-none font-semibold tracking-tight lg:mt-0">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the account issued to you by your administrator.
          </p>

          <div className="mt-6">
            <SignInForm callbackUrl={callbackUrl} />
          </div>

          {process.env.NODE_ENV !== "production" && (
            <div className="mt-6 rounded-lg border border-dashed border-[var(--grid-line)] p-3.5">
              <p className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                Development accounts
              </p>
              <dl className="mt-2 space-y-1.5 font-mono text-[11px] tabular-nums">
                {[
                  ["Program Manager", "manager@example.gov.ph", "manager1234"],
                  ["Viewer", "viewer@example.gov.ph", "viewer1234"],
                  ["Administrator", "admin@example.gov.ph", "admin1234"],
                ].map(([role, email, pw]) => (
                  <div key={email} className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="w-[108px] shrink-0 font-sans text-muted-foreground">
                      {role}
                    </dt>
                    <dd className="text-foreground/80">
                      {email} · {pw}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2.5 border-t border-[var(--grid-line)] pt-2 text-[11px] text-muted-foreground">
                Shown only in development. Change these before the system is
                used.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

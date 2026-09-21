import Link from "next/link";

import { BookingForm } from "@/components/booking-form";
import { requireManagerPage } from "@/lib/authz";
import { getLookups } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewActivityPage() {
  await requireManagerPage();
  const lookups = await getLookups();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5"><path d="m15 18-6-6 6-6" /></svg>
          Calendar
        </Link>
        <h1 className="mt-1.5 text-[26px] leading-none font-semibold tracking-tight">
          Book an Activity
        </h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
          The date, venue and participant checks run against the live calendar as
          you fill this in. Each one can be accepted and continued past — doing
          so is recorded against the activity.
        </p>
      </div>

      <BookingForm
        lookups={{
          divisions: lookups.divisions.map((d) => ({
            id: d.id,
            name: d.name,
            acronym: d.acronym,
          })),
          programs: lookups.programs.map((p) => ({ id: p.id, name: p.name })),
          venues: lookups.venues.map((v) => ({
            id: v.id,
            name: v.name,
            location: v.location,
            capacity: v.capacity,
            isBookable: v.isBookable,
          })),
          people: lookups.people.map((p) => ({
            id: p.id,
            fullName: p.fullName,
            position: p.position,
            division: p.division ? { acronym: p.division.acronym } : null,
          })),
        }}
      />
    </div>
  );
}

import Link from "next/link";

import { BookingForm } from "@/components/booking-form";
import { requireManagerPage } from "@/lib/authz";
import { getLookups } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewActivityPage() {
  await requireManagerPage();
  const lookups = await getLookups();

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
      <div className="anim-up flex flex-col gap-1.5">
        <Link
          href="/calendar"
          className="self-start text-sm font-semibold text-primary hover:text-[var(--primary-hover)]"
        >
          ← Back to calendar
        </Link>
        <h1 className="text-[32px] leading-tight">Book an activity</h1>
        <p className="max-w-[70ch] text-[15px] text-muted-foreground">
          The date, venue and participant checks run against the live calendar as
          you fill this in. Each one can be continued past — doing so is
          recorded against the activity.
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

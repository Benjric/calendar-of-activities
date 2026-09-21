# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three confirmed roles, decided by the user:

- **Encoder** — books activities and updates their status. The primary user. Works
  inside an office division, entering activities that division leads.
- **Viewer** — reads the calendar. Needs to know what is happening, where, and who
  is committed. Does not edit.
- **Admin** — manages lookups (divisions, venues, programs, people) and sees all
  divisions' activities.

[inferred] The operating unit is a Philippine government field or regional office
running a Learning & Development calendar. Evidence: the fund sources in the spec
(MOOE, HRTD, PSF), the L&D / Non-L&D classification, "Means of Verification",
"Performance Indicator", and the reference to a Supply Office for venue disputes.
The specific agency and office have not been confirmed.

[inferred] Encoders are administrative and technical staff, not specialists in
software. The booking flow is something they do occasionally — a handful of times
a month — not continuously, so it cannot rely on remembered steps.

## Product Purpose

A single calendar of activities for the office, covering the whole lifecycle of an
activity rather than only its scheduling: book it, detect collisions before they
happen, then report what actually occurred against what was planned.

Success means two things the office cannot do reliably today:

1. **Collisions are seen at the moment of booking**, not discovered on the day —
   a double-booked training hall, a date already claimed, staff committed to two
   activities at once.
2. **Targets and accomplishments live on the same record**, so variance reporting
   is a property of the activity rather than a separate spreadsheet assembled
   later.

## Positioning

A generic shared calendar can store a date; it cannot tell you that the venue is
taken, that four of your participants are already committed elsewhere that week,
or that this activity exceeded its physical target while underspending its budget.
The conflict checks and the target-versus-accomplishment reporting are the same
system here, because in this office they are the same workflow.

## Operating Context

**Booking (spec Phase 1)** — a six-step flow: core details and program; date
validation; venue availability; participant availability; admin details (lead
division, focal person, venue); financials and classification.

Three conflict checks run against the live database during booking. All three are
**advisory** — each offers "Continue anyway", because concurrent activities,
shared venues, and double-booked staff are all sometimes intentional. The system
surfaces the collision; the human decides.

**Lifecycle (spec Phase 2)** — once saved, an activity is managed by status:

- **Conducted** — opens target-vs-accomplishment reporting for both physical and
  financial dimensions, plus upload of Completion Reports and MOVs.
- **Rescheduled** — captures a reason and a proposed new schedule, re-runs the
  date conflict check, and feeds the catch-up plan. An activity may slip more than
  once.
- **Dropped** — captures a reason. The activity leaves the active calendar but
  stays in the archive.

[inferred] Activities are planned well ahead — a yearly or quarterly calendar
agreed in advance — then revised as the year progresses. This is why postponement
is a first-class status rather than an edit.

## Capabilities and Constraints

**Confirmed decisions:**

- Scheduling is **date-only and may span multiple days**. No times. Conflict
  detection is day-granularity range overlap, inclusive at both ends.
- **Variance is computed, never stored**: `result = accomplishment − target`.
  `> 0` is a Gain (requires Notable Practice), `< 0` a Gap (requires
  Justification), `= 0` Met.
- **Physical and financial variance are independent.** One activity can show a
  Gain and a Gap at once and must be able to explain both separately.
- Dropped activities are **soft-deleted**, not removed.
- Deployment target is **Vercel**, with PostgreSQL.

**Terminology** (the office's words, which the interface must not paraphrase):
MOV (Means of Verification), MOOE, HRTD, PSF, L&D and Non-L&D, Lead Division,
Focal Person, Performance Indicator, Notable Practice, Justification, Catch-up
Plan, Source of Fund.

**Undecided:** the real division, venue, and program lists (currently placeholder
seed data); authentication provider; whether Viewers are restricted by division.

## Evidence on Hand

- Two specification screenshots from the user defining the booking flow and the
  status/update flow. These are the authority for step order, alert wording, and
  conditional field behavior.
- A working database with placeholder seed data at `prisma/seed.ts`. The five
  divisions, five venues, five programs, and eight people in it are **invented for
  development** and must not be presented as real office data.
- No logo, brand assets, official color palette, or agency style guide has been
  provided. Future work must not fabricate agency identity, seals, or insignia.

## Product Principles

1. **Warn, never block.** Every conflict check is advisory. The system's duty is
   to make a collision impossible to miss, not to overrule the person booking.
2. **Record the override.** A decision to proceed past a conflict is itself data.
   Who waved it through, and what it collided with, must survive the meeting it
   was decided in.
3. **Derive what can be derived.** Variance is computed from its inputs so it can
   never contradict them.
4. **Absent is not zero.** An unreported accomplishment is not a shortfall. The
   interface must distinguish "not yet entered" from "underperformed".
5. **Speak the office's language.** MOV, MOOE, Focal Person and Notable Practice
   are the terms staff already use in their reports; the interface uses them
   unchanged.

## Accessibility & Inclusion

[inferred] Government office deployment implies a public-sector accessibility
expectation; WCAG 2.1 AA is the working target until the user confirms otherwise.

[inferred] Mixed and older hardware, and modest screens, are likely. The calendar
must stay usable without a large monitor.

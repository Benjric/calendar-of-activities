"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { CollisionChecks } from "@/components/collision-checks";
import { ConflictAlert } from "@/components/conflict-alert";
import {
  ProgramCombobox,
  type ProgramOption,
} from "@/components/program-combobox";
import { PersonCombobox } from "@/components/person-combobox";
import { VenueCombobox, type VenueOption } from "@/components/venue-combobox";
import { bookActivity, checkConflicts } from "@/lib/actions";
import type { ConflictResult } from "@/lib/conflicts";
import { dayCount, formatDateRange, parseDateInput } from "@/lib/format";

type ConflictKind = ConflictResult["kind"];

interface Lookups {
  divisions: { id: string; name: string; acronym: string | null }[];
  programs: ProgramOption[];
  venues: VenueOption[];
  people: {
    id: string;
    fullName: string;
    position: string | null;
    division: { acronym: string | null } | null;
  }[];
}

const STEPS = [
  { n: 1, label: "Core details" },
  { n: 2, label: "Dates" },
  { n: 3, label: "Venue" },
  { n: 4, label: "Participants" },
  { n: 5, label: "Admin" },
  { n: 6, label: "Financials" },
] as const;

const FUNDS = ["MOOE", "HRTD", "PSF", "OTHER"] as const;

export function BookingForm({ lookups }: { lookups: Lookups }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [programName, setProgramName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [participantCount, setParticipantCount] = useState("");
  const [leadDivisionId, setLeadDivisionId] = useState("");
  const [focalPersonName, setFocalPersonName] = useState("");
  const [type, setType] = useState<"LND" | "NON_LND">("LND");
  const [performanceIndicator, setPerformanceIndicator] = useState("");
  const [hasFinancialReq, setHasFinancialReq] = useState(false);
  const [sourceOfFund, setSourceOfFund] = useState<string>("");
  const [sourceOfFundOther, setSourceOfFundOther] = useState("");
  const [physicalTarget, setPhysicalTarget] = useState("");
  const [financialTarget, setFinancialTarget] = useState("");

  // Live conflict state
  const [conflicts, setConflicts] = useState<ConflictResult[]>([]);
  const [checking, setChecking] = useState(false);
  const [acknowledged, setAcknowledged] = useState<ConflictKind[]>([]);

  const datesValid = Boolean(startDate && endDate && endDate >= startDate);

  /**
   * Re-checks on every change to dates or venue. The wizard reveals these
   * step by step, but the check always runs against the full current
   * selection — a venue picked in step 3 is checked at once.
   */
  const runCheck = useCallback(async () => {
    if (!datesValid) {
      setConflicts([]);
      return;
    }
    setChecking(true);
    try {
      const found = await checkConflicts({
        startDate,
        endDate,
        venueName: venueName.trim() || null,
        // Bookings record a head count, not names, so there is nobody to
        // check for double-booking; only dates and venue are checked.
        participantIds: [],
      });
      setConflicts(found);
      // Drop acknowledgements for conflicts that no longer exist, so an
      // accepted collision cannot silently carry over to a different date.
      setAcknowledged((prev) =>
        prev.filter((k) => found.some((c) => c.kind === k)),
      );
    } finally {
      setChecking(false);
    }
  }, [datesValid, startDate, endDate, venueName]);

  useEffect(() => {
    const t = setTimeout(runCheck, 250);
    return () => clearTimeout(t);
  }, [runCheck]);

  const toggleAck = (kind: ConflictKind, value: boolean) =>
    setAcknowledged((prev) =>
      value ? [...new Set([...prev, kind])] : prev.filter((k) => k !== kind),
    );

  const relevant = (kinds: ConflictKind[]) =>
    conflicts.filter((c) => kinds.includes(c.kind));

  const unresolved = conflicts.filter((c) => !acknowledged.includes(c.kind));

  function validateStep(n: number): boolean {
    const e: Record<string, string> = {};
    if (n === 1 && title.trim().length < 3) e.title = "Give the activity a title";
    if (n === 2) {
      if (!startDate) e.startDate = "Pick a start date";
      if (!endDate) e.endDate = "Pick an end date";
      if (startDate && endDate && endDate < startDate)
        e.endDate = "The end date cannot fall before the start date";
    }
    if (n === 4 && participantCount.trim() && !/^\d+$/.test(participantCount.trim()))
      e.participantCount = "Enter a whole number";
    if (n === 6 && hasFinancialReq) {
      if (!sourceOfFund) e.sourceOfFund = "Select a source of fund";
      if (sourceOfFund === "OTHER" && !sourceOfFundOther.trim())
        e.sourceOfFundOther = "Name the other fund source";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(6, s + 1));
  }

  function submit() {
    if (!validateStep(6)) return;
    setSubmitError(null);

    startTransition(async () => {
      const result = await bookActivity({
        title,
        programName,
        startDate,
        endDate,
        venueName,
        leadDivisionId,
        focalPersonName,
        participantCount,
        type,
        performanceIndicator,
        hasFinancialReq,
        sourceOfFund: hasFinancialReq && sourceOfFund ? sourceOfFund : undefined,
        sourceOfFundOther,
        physicalTarget,
        financialTarget,
        acknowledgedConflicts: acknowledged,
      });

      if (result.ok && result.activityId) {
        router.push(`/activities/${result.activityId}?booked=1`);
        return;
      }
      if (result.conflicts?.length) {
        setConflicts(result.conflicts);
        setSubmitError(
          "The calendar changed while this form was open. Review the conflicts below.",
        );
        return;
      }
      if (result.errors) {
        setErrors(result.errors);
        setSubmitError("Check the highlighted fields.");
      }
    });
  }

  /** A step is flagged once its own check has found something unaccepted. */
  const stepKind: Record<number, ConflictKind | undefined> = {
    2: "DATE",
    3: "VENUE",
  };


  const dateRange = (() => {
    const s = parseDateInput(startDate);
    const e = parseDateInput(endDate);
    if (!s || !e || e < s) return "—";
    const n = dayCount(s, e);
    return `${formatDateRange(s, e)} · ${n} ${n === 1 ? "day" : "days"}`;
  })();

  const reviseFor = (c: ConflictResult) =>
    c.kind === "VENUE"
      ? { onRevise: () => setVenueName(""), reviseLabel: "Choose another venue" }
      : {};

  const count = participantCount.trim() === "" ? null : Number(participantCount);
  const setCount = (n: number) =>
    setParticipantCount(String(Math.max(0, Math.min(100000, Math.round(n)))));

  const alertsFor = (kinds: ConflictKind[]) =>
    relevant(kinds).map((c) => (
      <ConflictAlert
        key={c.kind}
        conflict={c}
        acknowledged={acknowledged.includes(c.kind)}
        onAcknowledge={toggleAck}
        {...reviseFor(c)}
      />
    ));

  const nextLabel = STEPS.find((s) => s.n === step + 1)?.label;

  return (
    <div className="flex flex-col gap-5">
      {/* Step rail. Each step's bar fills as it is completed: green when clear,
          amber when a collision was continued past, red while one is open. */}
      <ol
        aria-label="Booking steps"
        className="surface anim-up m-0 grid list-none grid-cols-3 gap-x-2 gap-y-4 px-5 py-[18px] sm:grid-cols-6"
        style={{ animationDelay: "0.05s" }}
      >
        {STEPS.map((s) => {
          const done = s.n < step;
          const current = s.n === step;
          const kind = stepKind[s.n];
          const clash =
            done && kind
              ? conflicts.some((c) => c.kind === kind && c.hasConflict)
              : false;
          const accepted = clash && kind ? acknowledged.includes(kind) : false;

          const rail = clash
            ? accepted
              ? "bg-[var(--status-rescheduled-solid)]"
              : "bg-[var(--conflict)]"
            : "bg-[var(--status-conducted-solid)]";
          const tone = current
            ? "font-bold text-primary"
            : done
              ? clash
                ? accepted
                  ? "font-semibold text-[var(--status-rescheduled)]"
                  : "font-semibold text-[var(--conflict-text)]"
                : "font-semibold text-[var(--status-conducted)]"
              : "font-medium text-muted-foreground";

          return (
            <li key={s.n} aria-current={current ? "step" : undefined}>
              <button
                type="button"
                onClick={() => done && setStep(s.n)}
                disabled={!done}
                className="group flex w-full flex-col gap-2 text-left disabled:cursor-default"
              >
                <span className="block h-1 overflow-hidden rounded-full bg-border">
                  {done && (
                    <span
                      className={`anim-grow block h-full ${rail}`}
                      style={{ animationDuration: "0.8s" }}
                    />
                  )}
                  {current && <span className="block h-full bg-primary" />}
                </span>
                <span className={`flex items-center gap-2 text-sm ${tone} ${done ? "group-hover:underline" : ""}`}>
                  {done && !clash && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 shrink-0"><path d="M5 12l5 5 9-10" /></svg>
                  )}
                  {done && clash && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 shrink-0"><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.01" /></svg>
                  )}
                  <span className="truncate">
                    {s.n} · {s.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-start gap-5">
        <section
          className="surface anim-up flex min-w-0 flex-[999_1_560px] flex-col gap-[18px] p-6"
          style={{ animationDelay: "0.1s" }}
        >
          {/* Keyed by step, so moving between steps slides the new one in. */}
          <div key={step} className="anim-swap flex flex-col gap-[18px]">
            {step === 1 && (
              <Section title="Core details" hint="What is this activity called, and which program does it belong to?">
                <Field label="Title of activity" error={errors.title} required>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.currentTarget.value)}
                    placeholder="e.g. Instructional Leadership Training"
                    className="field-input"
                    aria-invalid={errors.title ? true : undefined}
                    autoFocus
                  />
                </Field>
                <Field label="Specific program">
                  <ProgramCombobox
                    value={programName}
                    onChange={setProgramName}
                    programs={lookups.programs}
                    className="field-input"
                  />
                </Field>
              </Section>
            )}

            {step === 2 && (
              <Section title="Dates" hint="Activities span whole days. The range is checked against everything already committed.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Start date" error={errors.startDate} required>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.currentTarget.value)} className="field-input" aria-invalid={errors.startDate ? true : undefined} />
                  </Field>
                  <Field label="End date" error={errors.endDate} required>
                    <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.currentTarget.value)} className="field-input" aria-invalid={errors.endDate ? true : undefined} />
                  </Field>
                </div>
                <CheckState checking={checking} found={relevant(["DATE"])} clean={datesValid} cleanMsg="No other activity falls in this range." />
                {alertsFor(["DATE"])}
              </Section>
            )}

            {step === 3 && (
              <Section title="Venue" hint={datesValid ? `Availability is checked against every booking on ${dateRange.split(" · ")[0]}.` : "Pick the dates first, then the venue is checked against them."}>
                <Field label="Venue">
                  <VenueCombobox
                    value={venueName}
                    onChange={setVenueName}
                    venues={lookups.venues}
                    className="field-input"
                  />
                </Field>
                <p className="-mt-2 text-[13px] text-muted-foreground">
                  Names already used are suggested; a new name is saved and suggested next time.
                </p>
                <CheckState checking={checking} found={relevant(["VENUE"])} clean={datesValid && Boolean(venueName.trim())} cleanMsg={`${venueName.trim() || "This venue"} is free on the selected dates.`} />
                {alertsFor(["VENUE"])}
              </Section>
            )}

            {step === 4 && (
              <Section title="Participants" hint="How many people are expected to attend. Only the number is recorded.">
                <div>
                  <label htmlFor="participant-count" className="mb-1.5 block text-[15px] font-semibold">
                    Number of participants
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="field-shell flex h-14 items-stretch overflow-hidden rounded-xl border border-[var(--input)] bg-card">
                      <button
                        type="button"
                        aria-label="One fewer participant"
                        onClick={() => setCount((count ?? 0) - 1)}
                        disabled={!count}
                        className="press grid w-12 place-items-center text-[var(--body-muted)] transition-colors hover:bg-accent disabled:opacity-40"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="size-4"><path d="M5 12h14" /></svg>
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={participantCount}
                        onChange={(e) => setParticipantCount(e.currentTarget.value.replace(/[^\d]/g, ""))}
                        placeholder="0"
                        aria-invalid={errors.participantCount ? true : undefined}
                        id="participant-count"
                        className="figure w-28 border-x border-[var(--grid-line)] bg-transparent text-center text-2xl font-semibold outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        aria-label="One more participant"
                        onClick={() => setCount((count ?? 0) + 1)}
                        className="press grid w-12 place-items-center text-[var(--body-muted)] transition-colors hover:bg-accent"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="size-4"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                    </div>
                    <span className="text-[15px] text-muted-foreground">
                      {count === null ? "Leave blank if not yet known." : count === 1 ? "participant" : "participants"}
                    </span>
                  </div>
                  {errors.participantCount && (
                    <span className="anim-open mt-1.5 block text-[13px] font-medium text-[var(--conflict-text)]">{errors.participantCount}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Quick pick</span>
                  {[10, 25, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      aria-pressed={count === n}
                      className={`press min-h-10 rounded-full border px-4 text-sm font-semibold tabular-nums transition-[background-color,border-color,color] duration-200 ${
                        count === n
                          ? "border-primary bg-[var(--primary-tint)] text-primary"
                          : "border-border bg-card text-[var(--body-muted)] hover:border-[var(--meter-target)]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {step === 5 && (
              <Section title="Admin details" hint="Who owns this activity.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Lead Division">
                    <select value={leadDivisionId} onChange={(e) => setLeadDivisionId(e.currentTarget.value)} className="field-input">
                      <option value="">— Not set —</option>
                      {lookups.divisions.map((d) => (
                        <option key={d.id} value={d.id}>{d.acronym ? `${d.acronym} — ${d.name}` : d.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Focal Person">
                    <PersonCombobox
                      value={focalPersonName}
                      onChange={setFocalPersonName}
                      people={lookups.people}
                      className="field-input"
                    />
                  </Field>
                </div>
              </Section>
            )}

            {step === 6 && (
              <Section title="Financials & classification" hint="Targets recorded now are what accomplishment is measured against later.">
                <Field label="Type" required>
                  <Segmented
                    value={type}
                    onChange={(v) => setType(v as "LND" | "NON_LND")}
                    options={[
                      { value: "LND", label: "L&D" },
                      { value: "NON_LND", label: "Non-L&D" },
                    ]}
                  />
                </Field>

                <Field label="Performance Indicator">
                  <input value={performanceIndicator} onChange={(e) => setPerformanceIndicator(e.currentTarget.value)} placeholder="e.g. No. of school heads trained" className="field-input" />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Physical target">
                    <input type="number" min="0" step="any" value={physicalTarget} onChange={(e) => setPhysicalTarget(e.currentTarget.value)} placeholder="e.g. 100" className="field-input tabular-nums" />
                  </Field>
                  <Field label="Financial target (₱)">
                    <input type="number" min="0" step="any" value={financialTarget} onChange={(e) => setFinancialTarget(e.currentTarget.value)} placeholder="e.g. 250000" className="field-input tabular-nums" />
                  </Field>
                </div>

                <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-[15px] transition-colors ${hasFinancialReq ? "border-primary bg-[var(--primary-tint)]" : "border-border hover:bg-[var(--header-bg)]"}`}>
                  <input type="checkbox" checked={hasFinancialReq} onChange={(e) => setHasFinancialReq(e.currentTarget.checked)} className="size-4 accent-[var(--primary)]" />
                  <span className="font-semibold">This activity has financial requirements</span>
                </label>

                {hasFinancialReq && (
                  <div className="anim-open flex flex-col gap-4">
                    <Field label="Source of Fund" error={errors.sourceOfFund} required>
                      <Segmented
                        value={sourceOfFund}
                        onChange={setSourceOfFund}
                        options={FUNDS.map((f) => ({ value: f, label: f === "OTHER" ? "Other" : f }))}
                      />
                    </Field>
                    {sourceOfFund === "OTHER" && (
                      <Field label="Specify fund source" error={errors.sourceOfFundOther} required>
                        <input value={sourceOfFundOther} onChange={(e) => setSourceOfFundOther(e.currentTarget.value)} className="field-input" aria-invalid={errors.sourceOfFundOther ? true : undefined} />
                      </Field>
                    )}
                  </div>
                )}

                {/* Outstanding conflicts summary before the save. */}
                {unresolved.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-[15px] font-semibold">
                      {unresolved.length} unresolved{" "}
                      {unresolved.length === 1 ? "conflict" : "conflicts"}. Continue
                      past each, or go back and change the booking.
                    </p>
                    {unresolved.map((c) => (
                      <ConflictAlert key={c.kind} conflict={c} acknowledged={acknowledged.includes(c.kind)} onAcknowledge={toggleAck} {...reviseFor(c)} />
                    ))}
                  </div>
                )}
              </Section>
            )}
          </div>

          {submitError && (
            <p role="alert" className="anim-alert rounded-xl border border-[var(--conflict-border)] bg-[var(--conflict-bg)] px-4 py-3 text-[15px] text-[var(--conflict-text)]">
              {submitError}
            </p>
          )}

          <div className="flex justify-between gap-2.5 border-t border-[var(--grid-line)] pt-5">
            {step > 1 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-ghost">
                Back
              </button>
            ) : (
              <span />
            )}
            {step < 6 ? (
              <button type="button" onClick={next} className="btn-primary">
                Next: {nextLabel}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="arr size-4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={pending || unresolved.length > 0} className="btn-primary">
                {pending && <span aria-hidden="true" className="anim-spin size-4 rounded-full border-2 border-white/35 border-t-white" />}
                {pending ? "Saving…" : "Save activity"}
              </button>
            )}
          </div>
        </section>

        <aside
          aria-label="Booking summary"
          className="anim-up flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 lg:sticky lg:top-24"
          style={{ animationDelay: "0.15s" }}
        >
          <section className="surface flex flex-col gap-3 px-5 py-[18px]">
            <h2 className="eyebrow font-sans">So far</h2>
            <dl className="m-0 grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Title</dt>
              <dd className="m-0 font-semibold break-words">{title.trim() || "—"}</dd>
              <dt className="text-muted-foreground">Program</dt>
              <dd className="m-0 font-semibold">{programName.trim() || "—"}</dd>
              <dt className="text-muted-foreground">Dates</dt>
              <dd className="m-0 font-semibold tabular-nums">{dateRange}</dd>
              <dt className="text-muted-foreground">Venue</dt>
              <dd className="m-0 font-semibold">{venueName.trim() || "—"}</dd>
              <dt className="text-muted-foreground">Focal Person</dt>
              <dd className="m-0 font-semibold">{focalPersonName.trim() || "—"}</dd>
              <dt className="text-muted-foreground">People</dt>
              <dd className="m-0 font-semibold tabular-nums">{count ?? "—"}</dd>
            </dl>
          </section>

          <CollisionChecks
            conflicts={conflicts}
            acknowledged={acknowledged}
            checking={checking}
            step={step}
          />
        </aside>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl">{title}</h2>
        {hint && <p className="text-[15px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-semibold">
        {label}
        {required && <span className="ml-0.5 text-[var(--conflict)]">*</span>}
      </span>
      {children}
      {error && <span className="anim-open mt-1.5 block text-[13px] font-medium text-[var(--conflict-text)]">{error}</span>}
    </label>
  );
}

/** A row of mutually exclusive choices, styled like the mockup's option cards. */
function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <span role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`press min-h-11 rounded-[10px] border-[1.5px] px-4 text-[15px] font-semibold transition-[border-color,background-color,box-shadow] duration-200 ${
              on
                ? "border-primary bg-[var(--primary-tint)] text-primary shadow-[0_0_0_3px_rgb(29_78_216/0.12)]"
                : "border-border bg-card hover:border-[var(--meter-target)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}

function CheckState({ checking, found, clean, cleanMsg }: { checking: boolean; found: unknown[]; clean: boolean; cleanMsg: string }) {
  if (checking) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true" className="anim-spin size-3.5 rounded-full border-2 border-[var(--input)] border-t-primary" />
        Checking the calendar…
      </p>
    );
  }
  if (clean && found.length === 0) {
    return (
      <p className="anim-pop flex items-center gap-3 rounded-[14px] border border-[var(--status-conducted-border)] bg-[var(--status-conducted-bg)] px-4 py-3.5 text-[15px] font-semibold text-[var(--status-conducted)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0"><path d="M5 12l5 5 9-10" /></svg>
        {cleanMsg}
      </p>
    );
  }
  return null;
}

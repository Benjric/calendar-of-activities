"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { CollisionChecks } from "@/components/collision-checks";
import { ConflictAlert } from "@/components/conflict-alert";
import {
  ProgramCombobox,
  type ProgramOption,
} from "@/components/program-combobox";
import { VenueCombobox, type VenueOption } from "@/components/venue-combobox";
import { bookActivity, checkConflicts } from "@/lib/actions";
import type { ConflictResult } from "@/lib/conflicts";

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
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [leadDivisionId, setLeadDivisionId] = useState("");
  const [focalPersonId, setFocalPersonId] = useState("");
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
   * Re-checks on every change to dates, venue, or participants. The wizard
   * reveals these step by step, but the check always runs against the full
   * current selection — a venue picked in step 3 must not wait for step 4.
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
        participantIds,
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
  }, [datesValid, startDate, endDate, venueName, participantIds]);

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
        focalPersonId,
        participantIds,
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
        router.push(`/activities/${result.activityId}`);
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
    4: "PARTICIPANT",
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[228px_minmax(0,1fr)] xl:grid-cols-[228px_minmax(0,1fr)_330px]">
      {/* Step rail */}
      <ol className="surface h-fit overflow-hidden p-1.5 lg:sticky lg:top-20">
        {STEPS.map((s) => {
          const done = s.n < step;
          const current = s.n === step;
          const kind = stepKind[s.n];
          const clash =
            done && kind
              ? conflicts.some((c) => c.kind === kind && c.hasConflict)
              : false;
          const accepted = clash && kind ? acknowledged.includes(kind) : false;

          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => s.n <= step && setStep(s.n)}
                disabled={s.n > step}
                className={`flex w-full items-start gap-3 rounded-[10px] p-3 text-left text-sm transition-colors ${
                  current
                    ? "border border-input bg-card font-bold"
                    : done
                      ? "hover:bg-accent"
                      : "cursor-not-allowed text-muted-foreground"
                }`}
              >
                <span
                  className={`grid size-6.5 shrink-0 place-items-center rounded-full text-[13px] font-bold tabular-nums ${
                    clash
                      ? "bg-[var(--conflict)] text-white"
                      : current
                        ? "bg-primary text-primary-foreground"
                        : done
                          ? "bg-[var(--status-conducted-solid)] text-white"
                          : "border-[1.5px] border-input"
                  }`}
                >
                  {clash ? "!" : done ? "✓" : s.n}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                  <span className={current ? "font-bold" : "font-medium"}>
                    {s.label}
                  </span>
                  {clash && (
                    <span className="text-xs font-semibold text-[var(--conflict-text)]">
                      {accepted ? "Overlap continued · recorded" : "Collision found"}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="space-y-4">
        <div className="surface p-5">
          {step === 1 && (
            <Section title="Core details" hint="What is this activity called, and which program does it belong to?">
              <Field label="Title of activity" error={errors.title} required>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.currentTarget.value)}
                  placeholder="e.g. Instructional Leadership Training"
                  className={inputCls(errors.title)}
                  autoFocus
                />
              </Field>
              <Field label="Specific program">
                <ProgramCombobox
                  value={programName}
                  onChange={setProgramName}
                  programs={lookups.programs}
                  className={inputCls()}
                />
              </Field>
            </Section>
          )}

          {step === 2 && (
            <Section title="Dates" hint="Activities span whole days. The system checks this range against everything already committed.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start date" error={errors.startDate} required>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.currentTarget.value)} className={inputCls(errors.startDate)} />
                </Field>
                <Field label="End date" error={errors.endDate} required>
                  <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.currentTarget.value)} className={inputCls(errors.endDate)} />
                </Field>
              </div>
              <CheckState checking={checking} found={relevant(["DATE"])} clean={datesValid} cleanMsg="No other activity falls in this range." />
              {relevant(["DATE"]).map((c) => (
                <ConflictAlert key={c.kind} conflict={c} acknowledged={acknowledged.includes(c.kind)} onAcknowledge={toggleAck} />
              ))}
            </Section>
          )}

          {step === 3 && (
            <Section title="Venue availability" hint="Type the venue. Names already used are suggested; a new name is saved and suggested next time.">
              <Field label="Venue">
                <VenueCombobox
                  value={venueName}
                  onChange={setVenueName}
                  venues={lookups.venues}
                  className={inputCls()}
                />
              </Field>
              <CheckState checking={checking} found={relevant(["VENUE"])} clean={datesValid && Boolean(venueName.trim())} cleanMsg="This venue is free for the selected dates." />
              {relevant(["VENUE"]).map((c) => (
                <ConflictAlert key={c.kind} conflict={c} acknowledged={acknowledged.includes(c.kind)} onAcknowledge={toggleAck} />
              ))}
            </Section>
          )}

          {step === 4 && (
            <Section title="Participant availability" hint="Anyone already committed to an overlapping activity is flagged.">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  Participants{" "}
                  <span className="font-normal text-muted-foreground">
                    ({participantIds.length} selected)
                  </span>
                </legend>
                <div className="max-h-64 space-y-px overflow-y-auto rounded-lg border border-[var(--grid-line)] p-1">
                  {lookups.people.map((p) => {
                    const checked = participantIds.includes(p.id);
                    return (
                      <label key={p.id} className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${checked ? "bg-accent" : "hover:bg-accent/50"}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            // Read the value NOW. React clears `currentTarget`
                            // once the handler returns, and the updater below
                            // runs later — reading it in there throws.
                            const isChecked = e.currentTarget.checked;
                            setParticipantIds((prev) =>
                              isChecked
                                ? [...new Set([...prev, p.id])]
                                : prev.filter((id) => id !== p.id),
                            );
                          }}
                          className="size-4 accent-[var(--primary)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{p.fullName}</span>
                          {p.position && <span className="block text-[11px] text-muted-foreground">{p.position}</span>}
                        </span>
                        {p.division?.acronym && (
                          <span className="shrink-0 rounded border border-[var(--grid-line)] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {p.division.acronym}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <CheckState checking={checking} found={relevant(["PARTICIPANT"])} clean={datesValid && participantIds.length > 0} cleanMsg="Everyone selected is free for these dates." />
              {relevant(["PARTICIPANT"]).map((c) => (
                <ConflictAlert key={c.kind} conflict={c} acknowledged={acknowledged.includes(c.kind)} onAcknowledge={toggleAck} />
              ))}
            </Section>
          )}

          {step === 5 && (
            <Section title="Admin details" hint="Who owns this activity.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lead division">
                  <select value={leadDivisionId} onChange={(e) => setLeadDivisionId(e.currentTarget.value)} className={inputCls()}>
                    <option value="">— Not set —</option>
                    {lookups.divisions.map((d) => (
                      <option key={d.id} value={d.id}>{d.acronym ? `${d.acronym} — ${d.name}` : d.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Focal person">
                  <select value={focalPersonId} onChange={(e) => setFocalPersonId(e.currentTarget.value)} className={inputCls()}>
                    <option value="">— Not set —</option>
                    {lookups.people.map((p) => (
                      <option key={p.id} value={p.id}>{p.fullName}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>
          )}

          {step === 6 && (
            <Section title="Financials & classification" hint="Targets recorded now are what accomplishment is measured against later.">
              <Field label="Type" required>
                <div className="flex gap-2">
                  {(["LND", "NON_LND"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setType(t)} className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${type === t ? "border-primary bg-primary text-primary-foreground" : "border-[var(--grid-line)] hover:bg-accent"}`}>
                      {t === "LND" ? "L&D" : "Non-L&D"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Performance indicator">
                <input value={performanceIndicator} onChange={(e) => setPerformanceIndicator(e.currentTarget.value)} placeholder="e.g. No. of school heads trained" className={inputCls()} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Physical target">
                  <input type="number" min="0" step="any" value={physicalTarget} onChange={(e) => setPhysicalTarget(e.currentTarget.value)} placeholder="e.g. 100" className={`${inputCls()} font-mono tabular-nums`} />
                </Field>
                <Field label="Financial target (₱)">
                  <input type="number" min="0" step="any" value={financialTarget} onChange={(e) => setFinancialTarget(e.currentTarget.value)} placeholder="e.g. 250000" className={`${inputCls()} font-mono tabular-nums`} />
                </Field>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--grid-line)] px-3 py-2.5 text-sm">
                <input type="checkbox" checked={hasFinancialReq} onChange={(e) => setHasFinancialReq(e.currentTarget.checked)} className="size-4 accent-[var(--primary)]" />
                <span className="font-medium">This activity has financial requirements</span>
              </label>

              {hasFinancialReq && (
                <>
                  <Field label="Source of fund" error={errors.sourceOfFund} required>
                    <div className="flex flex-wrap gap-2">
                      {FUNDS.map((f) => (
                        <button key={f} type="button" onClick={() => setSourceOfFund(f)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${sourceOfFund === f ? "border-primary bg-primary text-primary-foreground" : "border-[var(--grid-line)] hover:bg-accent"}`}>
                          {f === "OTHER" ? "Other" : f}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {sourceOfFund === "OTHER" && (
                    <Field label="Specify fund source" error={errors.sourceOfFundOther} required>
                      <input value={sourceOfFundOther} onChange={(e) => setSourceOfFundOther(e.currentTarget.value)} className={inputCls(errors.sourceOfFundOther)} />
                    </Field>
                  )}
                </>
              )}
            </Section>
          )}
        </div>

        {submitError && (
          <p role="alert" className="rounded-lg border border-[var(--conflict)]/35 bg-[var(--conflict-bg)] px-3.5 py-2.5 text-sm text-[var(--conflict)]">
            {submitError}
          </p>
        )}

        {/* Outstanding conflicts summary, visible from any step */}
        {step === 6 && unresolved.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-sm font-medium">
              {unresolved.length} unresolved{" "}
              {unresolved.length === 1 ? "conflict" : "conflicts"}. Accept each
              to continue, or go back and change the booking.
            </p>
            {unresolved.map((c) => (
              <ConflictAlert key={c.kind} conflict={c} acknowledged={acknowledged.includes(c.kind)} onAcknowledge={toggleAck} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {step > 1 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="rounded-lg border border-[var(--grid-line)] bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
              Back
            </button>
          )}
          {step < 6 ? (
            <button type="button" onClick={next} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Continue
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={pending || unresolved.length > 0} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? "Saving…" : "Save activity"}
            </button>
          )}
        </div>
      </div>

      {/* Below the form on narrow screens, beside it from xl up — the checks
          are reference, not something to scroll past to reach the fields. */}
      <div className="lg:col-span-2 xl:col-span-1">
        <CollisionChecks
          conflicts={conflicts}
          acknowledged={acknowledged}
          checking={checking}
          step={step}
        />
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-[var(--conflict)]">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-[12px] text-[var(--conflict)]">{error}</span>}
    </label>
  );
}

function CheckState({ checking, found, clean, cleanMsg }: { checking: boolean; found: unknown[]; clean: boolean; cleanMsg: string }) {
  if (checking) {
    return <p className="text-[13px] text-muted-foreground">Checking the calendar…</p>;
  }
  if (clean && found.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-[var(--status-conducted)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5"><path d="M20 6 9 17l-5-5" /></svg>
        {cleanMsg}
      </p>
    );
  }
  return null;
}

function inputCls(error?: string) {
  return `w-full rounded-lg border bg-card px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 ${
    error ? "border-[var(--conflict)]" : "border-[var(--grid-line)]"
  }`;
}

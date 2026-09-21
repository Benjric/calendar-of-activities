"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConflictAlert } from "@/components/conflict-alert";
import {
  dropActivity,
  recordConducted,
  rescheduleActivity,
  restoreActivity,
} from "@/lib/actions";
import type { ConflictResult } from "@/lib/conflicts";
import { classify, type VarianceOutcome } from "@/lib/variance";

type Mode = "conducted" | "rescheduled" | "dropped" | null;

interface Props {
  activityId: string;
  status: "PLANNED" | "CONDUCTED" | "RESCHEDULED" | "DROPPED";
  initial: {
    physicalTarget: string;
    physicalAccomplishment: string;
    financialTarget: string;
    financialAccomplishment: string;
    physicalNotablePractice: string;
    physicalJustification: string;
    financialNotablePractice: string;
    financialJustification: string;
    startDate: string;
    endDate: string;
  };
}

/** Live preview of what the entered numbers mean, before anything is saved. */
function previewOutcome(target: string, accomplishment: string): VarianceOutcome | null {
  if (target.trim() === "" || accomplishment.trim() === "") return null;
  const t = Number(target);
  const a = Number(accomplishment);
  if (!Number.isFinite(t) || !Number.isFinite(a)) return null;
  return classify(Math.round((a - t + Number.EPSILON) * 100) / 100);
}

export function StatusActions({ activityId, status, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<ConflictResult[]>([]);
  const [acknowledged, setAcknowledged] = useState<ConflictResult["kind"][]>([]);

  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof initial, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [reason, setReason] = useState("");
  const [proposedStart, setProposedStart] = useState(initial.startDate);
  const [proposedEnd, setProposedEnd] = useState(initial.endDate);
  const [dropReason, setDropReason] = useState("");

  const physicalOutcome = previewOutcome(form.physicalTarget, form.physicalAccomplishment);
  const financialOutcome = previewOutcome(form.financialTarget, form.financialAccomplishment);

  function handleConducted() {
    setErrors({});
    startTransition(async () => {
      const r = await recordConducted({ activityId, ...form });
      if (r.ok) {
        setMode(null);
        router.refresh();
      } else if (r.errors) setErrors(r.errors);
    });
  }

  function handleReschedule() {
    setErrors({});
    startTransition(async () => {
      const r = await rescheduleActivity({
        activityId,
        reasonForPostponement: reason,
        proposedStartDate: proposedStart,
        proposedEndDate: proposedEnd,
        acknowledgedConflicts: acknowledged,
      });
      if (r.ok) {
        setMode(null);
        router.refresh();
      } else if (r.conflicts?.length) {
        setConflicts(r.conflicts);
      } else if (r.errors) setErrors(r.errors);
    });
  }

  function handleDrop() {
    setErrors({});
    startTransition(async () => {
      const r = await dropActivity({ activityId, reasonForDropping: dropReason });
      if (r.ok) {
        setMode(null);
        router.refresh();
      } else if (r.errors) setErrors(r.errors);
    });
  }

  if (status === "DROPPED") {
    return (
      <div className="surface p-4">
        <h2 className="text-sm font-semibold">Dropped</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          This activity is archived. It stays on record but no longer appears on
          the active calendar.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await restoreActivity(activityId);
              router.refresh();
            })
          }
          className="mt-3 rounded-lg border border-[var(--grid-line)] bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Restoring…" : "Restore to calendar"}
        </button>
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      <h2 className="border-b border-[var(--grid-line)] px-4 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        Update status
      </h2>

      <div className="p-4">
        {mode === null && (
          <>
            <p className="text-[13px] text-muted-foreground">
              Each status opens the fields that status requires.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode("conducted")} className="rounded-lg border border-[var(--status-conducted)]/35 bg-[var(--status-conducted-bg)] px-3.5 py-2 text-sm font-medium text-[var(--status-conducted)] transition-colors hover:border-[var(--status-conducted)]/60">
                Mark Conducted
              </button>
              <button type="button" onClick={() => setMode("rescheduled")} className="rounded-lg border border-[var(--status-rescheduled)]/35 bg-[var(--status-rescheduled-bg)] px-3.5 py-2 text-sm font-medium text-[var(--status-rescheduled)] transition-colors hover:border-[var(--status-rescheduled)]/60">
                Reschedule
              </button>
              <button type="button" onClick={() => setMode("dropped")} className="rounded-lg border border-[var(--grid-line)] px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent">
                Drop
              </button>
            </div>
          </>
        )}

        {mode === "conducted" && (
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Enter what was achieved. The system computes{" "}
              <span className="font-mono">accomplishment − target</span> for each
              dimension separately, and asks for the narrative that result calls
              for.
            </p>

            <Dimension
              label="Physical"
              target={form.physicalTarget}
              accomplishment={form.physicalAccomplishment}
              onTarget={(v) => set("physicalTarget", v)}
              onAccomplishment={(v) => set("physicalAccomplishment", v)}
              outcome={physicalOutcome}
              notablePractice={form.physicalNotablePractice}
              justification={form.physicalJustification}
              onNotablePractice={(v) => set("physicalNotablePractice", v)}
              onJustification={(v) => set("physicalJustification", v)}
              errorNotable={errors.physicalNotablePractice}
              errorJustification={errors.physicalJustification}
            />

            <Dimension
              label="Financial"
              money
              target={form.financialTarget}
              accomplishment={form.financialAccomplishment}
              onTarget={(v) => set("financialTarget", v)}
              onAccomplishment={(v) => set("financialAccomplishment", v)}
              outcome={financialOutcome}
              notablePractice={form.financialNotablePractice}
              justification={form.financialJustification}
              onNotablePractice={(v) => set("financialNotablePractice", v)}
              onJustification={(v) => set("financialJustification", v)}
              errorNotable={errors.financialNotablePractice}
              errorJustification={errors.financialJustification}
            />

            <Actions pending={pending} onCancel={() => setMode(null)} onSubmit={handleConducted} label="Save report" />
          </div>
        )}

        {mode === "rescheduled" && (
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              The new schedule is re-checked against the calendar, and this
              postponement joins the catch-up plan.
            </p>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Reason for postponement<span className="ml-0.5 text-[var(--conflict)]">*</span>
              </span>
              <textarea value={reason} onChange={(e) => setReason(e.currentTarget.value)} rows={3} className={`w-full rounded-lg border bg-card px-3 py-2 text-sm ${errors.reasonForPostponement ? "border-[var(--conflict)]" : "border-[var(--grid-line)]"}`} />
              {errors.reasonForPostponement && <span className="mt-1 block text-[12px] text-[var(--conflict)]">{errors.reasonForPostponement}</span>}
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">New start date</span>
                <input type="date" value={proposedStart} onChange={(e) => setProposedStart(e.currentTarget.value)} className="w-full rounded-lg border border-[var(--grid-line)] bg-card px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">New end date</span>
                <input type="date" value={proposedEnd} min={proposedStart} onChange={(e) => setProposedEnd(e.currentTarget.value)} className={`w-full rounded-lg border bg-card px-3 py-2 text-sm ${errors.proposedEndDate ? "border-[var(--conflict)]" : "border-[var(--grid-line)]"}`} />
                {errors.proposedEndDate && <span className="mt-1 block text-[12px] text-[var(--conflict)]">{errors.proposedEndDate}</span>}
              </label>
            </div>

            {conflicts.map((c) => (
              <ConflictAlert
                key={c.kind}
                conflict={c}
                acknowledged={acknowledged.includes(c.kind)}
                onAcknowledge={(kind, v) =>
                  setAcknowledged((prev) => (v ? [...new Set([...prev, kind])] : prev.filter((k) => k !== kind)))
                }
              />
            ))}

            <Actions pending={pending} onCancel={() => setMode(null)} onSubmit={handleReschedule} label="Reschedule" />
          </div>
        )}

        {mode === "dropped" && (
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              The activity leaves the active calendar but stays in the archive.
              It can be restored.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Reason for dropping<span className="ml-0.5 text-[var(--conflict)]">*</span>
              </span>
              <textarea value={dropReason} onChange={(e) => setDropReason(e.currentTarget.value)} rows={3} className={`w-full rounded-lg border bg-card px-3 py-2 text-sm ${errors.reasonForDropping ? "border-[var(--conflict)]" : "border-[var(--grid-line)]"}`} />
              {errors.reasonForDropping && <span className="mt-1 block text-[12px] text-[var(--conflict)]">{errors.reasonForDropping}</span>}
            </label>
            <Actions pending={pending} onCancel={() => setMode(null)} onSubmit={handleDrop} label="Drop activity" destructive />
          </div>
        )}
      </div>
    </div>
  );
}

function Dimension(props: {
  label: string;
  money?: boolean;
  target: string;
  accomplishment: string;
  onTarget: (v: string) => void;
  onAccomplishment: (v: string) => void;
  outcome: VarianceOutcome | null;
  notablePractice: string;
  justification: string;
  onNotablePractice: (v: string) => void;
  onJustification: (v: string) => void;
  errorNotable?: string;
  errorJustification?: string;
}) {
  const { outcome } = props;
  const result =
    props.target !== "" && props.accomplishment !== ""
      ? Number(props.accomplishment) - Number(props.target)
      : null;

  return (
    <fieldset className="rounded-lg border border-[var(--grid-line)] p-3.5">
      <legend className="px-1 text-sm font-semibold">{props.label}</legend>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted-foreground">
            Target{props.money && " (₱)"}
          </span>
          <input type="number" step="any" min="0" value={props.target} onChange={(e) => props.onTarget(e.currentTarget.value)} className="w-full rounded-lg border border-[var(--grid-line)] bg-card px-3 py-2 font-mono text-sm tabular-nums" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted-foreground">
            Accomplishment{props.money && " (₱)"}
          </span>
          <input type="number" step="any" min="0" value={props.accomplishment} onChange={(e) => props.onAccomplishment(e.currentTarget.value)} className="w-full rounded-lg border border-[var(--grid-line)] bg-card px-3 py-2 font-mono text-sm tabular-nums" />
        </label>
      </div>

      {outcome && result !== null && (
        <p className={`mt-2.5 flex items-center gap-1.5 text-[13px] font-medium ${
          outcome === "GAIN" ? "text-[var(--gain)]" : outcome === "GAP" ? "text-[var(--gap)]" : "text-[var(--met)]"
        }`}>
          <span aria-hidden="true">{outcome === "GAIN" ? "▲" : outcome === "GAP" ? "▼" : "="}</span>
          {outcome === "GAIN" ? "Gain" : outcome === "GAP" ? "Gap" : "Met"}
          <span className="font-mono tabular-nums">
            {result > 0 ? "+" : result < 0 ? "−" : ""}
            {Math.abs(result).toLocaleString("en-PH")}
          </span>
        </p>
      )}

      {outcome === "GAIN" && (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium">
            Notable Practice<span className="ml-0.5 text-[var(--conflict)]">*</span>
          </span>
          <textarea value={props.notablePractice} onChange={(e) => props.onNotablePractice(e.currentTarget.value)} rows={2} placeholder="What made exceeding the target possible?" className={`w-full rounded-lg border bg-card px-3 py-2 text-sm ${props.errorNotable ? "border-[var(--conflict)]" : "border-[var(--grid-line)]"}`} />
          {props.errorNotable && <span className="mt-1 block text-[12px] text-[var(--conflict)]">{props.errorNotable}</span>}
        </label>
      )}

      {outcome === "GAP" && (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium">
            Justification<span className="ml-0.5 text-[var(--conflict)]">*</span>
          </span>
          <textarea value={props.justification} onChange={(e) => props.onJustification(e.currentTarget.value)} rows={2} placeholder="Why did the accomplishment fall short?" className={`w-full rounded-lg border bg-card px-3 py-2 text-sm ${props.errorJustification ? "border-[var(--conflict)]" : "border-[var(--grid-line)]"}`} />
          {props.errorJustification && <span className="mt-1 block text-[12px] text-[var(--conflict)]">{props.errorJustification}</span>}
        </label>
      )}
    </fieldset>
  );
}

function Actions({ pending, onCancel, onSubmit, label, destructive }: { pending: boolean; onCancel: () => void; onSubmit: () => void; label: string; destructive?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--grid-line)] bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent">
        Cancel
      </button>
      <button type="button" onClick={onSubmit} disabled={pending} className={`ml-auto rounded-lg px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${destructive ? "bg-[var(--conflict)]" : "bg-primary"}`}>
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}

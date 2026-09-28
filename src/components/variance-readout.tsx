import {
  formatCount,
  formatCountSigned,
  formatPeso,
  formatPesoSigned,
} from "@/lib/format";
import {
  OUTCOME_DESCRIPTION,
  OUTCOME_LABEL,
  type Variance,
} from "@/lib/variance";

/**
 * One variance dimension, physical or financial.
 *
 * Renders target, accomplishment, and the derived result. Crucially it
 * distinguishes "not yet reported" from a shortfall: an activity marked
 * Conducted whose accomplishment nobody has entered shows as awaiting entry,
 * never as a Gap equal to the whole target.
 */

/*
 * Gain reads blue and Gap orange rather than green and red: the pair is the
 * one comparison in this product a reader with red-green colour blindness
 * would otherwise have to take on trust. The mark and the word carry it too.
 */
const OUTCOME_STYLE = {
  GAIN: "text-[var(--gain)]",
  GAP: "text-[var(--gap)]",
  MET: "text-[var(--met)]",
} as const;

/* The same three, as a tinted pill for the heading row. */
const OUTCOME_BADGE = {
  GAIN: "bg-[var(--gain-bg)] text-[var(--gain)]",
  GAP: "bg-[var(--gap-bg)] text-[var(--gap)]",
  MET: "bg-[var(--met-bg)] text-[var(--met)]",
} as const;

const OUTCOME_MARK = { GAIN: "▲", GAP: "▼", MET: "=" } as const;

export function VarianceReadout({
  label,
  variance,
  money = false,
}: {
  label: string;
  variance: Variance | null;
  money?: boolean;
}) {
  const fmt = money ? formatPeso : formatCount;
  const fmtSigned = money ? formatPesoSigned : formatCountSigned;

  if (!variance) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium">{label}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Not yet reported.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          A blank accomplishment is not a shortfall — it is simply not entered.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-bold ${OUTCOME_BADGE[variance.outcome]}`}
        >
          <span aria-hidden="true">{OUTCOME_MARK[variance.outcome]}</span>
          {OUTCOME_LABEL[variance.outcome]}
        </span>
      </div>

      <ProgressToTarget
        target={Number(variance.target)}
        accomplishment={Number(variance.accomplishment)}
        outcome={variance.outcome}
      />

      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Target</dt>
          <dd className="mt-0.5 font-mono tabular-nums">{fmt(variance.target)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Accomplishment</dt>
          <dd className="mt-0.5 font-mono tabular-nums">
            {fmt(variance.accomplishment)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Result</dt>
          <dd
            className={`mt-0.5 font-mono font-semibold tabular-nums ${OUTCOME_STYLE[variance.outcome]}`}
          >
            {fmtSigned(variance.result)}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-muted-foreground">
        {OUTCOME_DESCRIPTION[variance.outcome]}
        {variance.achievementRate !== null && (
          <> · {variance.achievementRate}% of target</>
        )}
      </p>
    </div>
  );
}

/**
 * Accomplishment drawn against target, with the target itself as a tick.
 *
 * The bar is scaled to whichever of the two is larger, so an overshoot has
 * somewhere to go: scaling to target alone would cap every Gain at a full
 * bar and make +1 look identical to +1000. The tick is what carries the
 * comparison — the fill only says how far along it got.
 */
function ProgressToTarget({
  target,
  accomplishment,
  outcome,
}: {
  target: number;
  accomplishment: number;
  outcome: "GAIN" | "GAP" | "MET";
}) {
  if (!Number.isFinite(target) || !Number.isFinite(accomplishment)) return null;
  if (target <= 0) return null;

  const ceiling = Math.max(target, accomplishment);
  const fill = Math.min(100, (accomplishment / ceiling) * 100);
  const tick = (target / ceiling) * 100;

  const fillColour =
    outcome === "GAIN"
      ? "bg-[var(--gain-solid)]"
      : outcome === "GAP"
        ? "bg-[var(--gap-solid)]"
        : "bg-[var(--met)]";

  return (
    <div className="mt-3">
      <div className="relative h-3 rounded-full bg-[var(--subtle)]">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${fillColour}`}
          style={{ width: `${fill}%` }}
        />
        {/* The target line sits above the fill so it stays readable when the
            bar runs past it. */}
        <div
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 w-0.5 bg-foreground"
          style={{ left: `${tick}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Target marked at {Math.round(tick)}% of the bar
      </p>
    </div>
  );
}

/**
 * The narrative the variance sign requires. A Gain asks for a Notable Practice,
 * a Gap for a Justification, and Met for neither — independently per dimension.
 */
export function NarrativeBlock({
  variance,
  notablePractice,
  justification,
}: {
  variance: Variance | null;
  notablePractice: string | null;
  justification: string | null;
}) {
  if (!variance || variance.requiredNarrative === null) return null;

  const isGain = variance.requiredNarrative === "notablePractice";
  const text = isGain ? notablePractice : justification;
  if (!text) return null;

  return (
    <div
      className={`mt-3 rounded-md border-l-2 bg-muted/40 px-3 py-2 ${
        isGain ? "border-l-[var(--gain)]" : "border-l-[var(--gap)]"
      }`}
    >
      <p className="text-xs font-medium text-muted-foreground">
        {isGain ? "Notable Practice" : "Justification"}
      </p>
      <p className="mt-1 text-sm">{text}</p>
    </div>
  );
}

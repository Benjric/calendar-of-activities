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
 * One variance dimension, physical or financial, drawn as the redesign's
 * target-against-accomplishment card.
 *
 * Crucially it distinguishes "not yet reported" from a shortfall: an activity
 * marked Conducted whose accomplishment nobody has entered shows as awaiting
 * entry, never as a Gap equal to the whole target.
 */

const OUTCOME_PILL = {
  GAIN: "border-[var(--gain-border)] bg-[var(--gain-bg)] text-[var(--gain)]",
  GAP: "border-[var(--gap-border)] bg-[var(--gap-bg)] text-[var(--gap)]",
  MET: "border-[var(--met-border)] bg-[var(--met-bg)] text-[var(--met)]",
} as const;

const OUTCOME_FILL = {
  GAIN: "bg-[var(--gain-solid)]",
  GAP: "bg-[var(--gap-solid)]",
  MET: "bg-[var(--met)]",
} as const;

function OutcomeIcon({ outcome }: { outcome: "GAIN" | "GAP" | "MET" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      {outcome === "GAIN" && <path d="M12 19V5M5 12l7-7 7 7" />}
      {outcome === "GAP" && <path d="M12 5v14M5 12l7 7 7-7" />}
      {outcome === "MET" && <path d="M5 9h14M5 15h14" />}
    </svg>
  );
}

export function VarianceReadout({
  label,
  subtitle,
  variance,
  money = false,
  delay = 0,
  children,
}: {
  label: string;
  subtitle?: string;
  variance: Variance | null;
  money?: boolean;
  /** Seconds to hold the meters back, so the second card follows the first. */
  delay?: number;
  children?: React.ReactNode;
}) {
  const fmt = money ? formatPeso : formatCount;
  const fmtSigned = money ? formatPesoSigned : formatCountSigned;

  return (
    <section
      className="surface anim-up flex flex-col gap-4 px-6 py-[22px]"
      style={{ animationDelay: `${delay.toFixed(2)}s` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[19px]">{label}</h2>
          {subtitle && (
            <span className="text-sm text-muted-foreground">{subtitle}</span>
          )}
        </div>
        {variance && (
          <span
            className={`anim-spring inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[15px] font-bold ${OUTCOME_PILL[variance.outcome]}`}
            style={{ animationDelay: `${(delay + 0.65).toFixed(2)}s` }}
          >
            <OutcomeIcon outcome={variance.outcome} />
            {OUTCOME_LABEL[variance.outcome]} · {fmtSigned(variance.result)}
          </span>
        )}
      </div>

      {variance ? (
        <>
          <Meters
            target={Number(variance.target)}
            accomplishment={Number(variance.accomplishment)}
            outcome={variance.outcome}
            targetText={fmt(variance.target)}
            accomplishmentText={fmt(variance.accomplishment)}
            delay={delay}
          />
          <p className="text-[13px] text-muted-foreground">
            {OUTCOME_DESCRIPTION[variance.outcome]}
            {variance.achievementRate !== null && (
              <> · {variance.achievementRate}% of target</>
            )}
          </p>
        </>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-[var(--input)] bg-[var(--outside-bg)] px-4 py-4">
          <p className="text-[15px] font-semibold">Not yet reported.</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            A blank accomplishment is not a shortfall — it is simply not entered.
          </p>
        </div>
      )}

      {children}
    </section>
  );
}

/**
 * Target and accomplishment as two bars on one scale, which is the larger of
 * the two — scaling to target alone would cap every Gain at a full bar and
 * make +1 look identical to +1000.
 */
function Meters({
  target,
  accomplishment,
  outcome,
  targetText,
  accomplishmentText,
  delay,
}: {
  target: number;
  accomplishment: number;
  outcome: "GAIN" | "GAP" | "MET";
  targetText: string;
  accomplishmentText: string;
  delay: number;
}) {
  const ceiling = Math.max(target, accomplishment, 0);
  const pct = (v: number) =>
    ceiling > 0 && Number.isFinite(v) ? Math.max(0, Math.min(100, (v / ceiling) * 100)) : 0;

  const rows = [
    { label: "Target", text: targetText, width: pct(target), fill: "bg-[var(--meter-target)]" },
    { label: "Accomplishment", text: accomplishmentText, width: pct(accomplishment), fill: OUTCOME_FILL[outcome] },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <div
          key={r.label}
          className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 text-[15px] sm:grid-cols-[130px_minmax(0,1fr)_120px]"
        >
          <span className="text-muted-foreground">{r.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-[var(--meter-track)]">
            <span
              className={`anim-grow block h-full rounded-full ${r.fill}`}
              style={{ width: `${r.width}%`, animationDelay: `${(delay + 0.2 + i * 0.15).toFixed(2)}s` }}
            />
          </span>
          <strong className="text-right tabular-nums">{r.text}</strong>
        </div>
      ))}
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
      className={`rounded-xl px-4 py-3 ${isGain ? "bg-[var(--gain-bg)]" : "bg-[var(--gap-bg)]"}`}
    >
      <p className={`text-[13px] font-bold ${isGain ? "text-[var(--gain)]" : "text-[var(--gap)]"}`}>
        {isGain ? "Notable Practice" : "Justification"}
      </p>
      <p className="mt-1 text-[15px] leading-relaxed">{text}</p>
    </div>
  );
}

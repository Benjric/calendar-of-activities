/**
 * Variance calculation for Conducted activities.
 *
 * The spec defines a single formula:  result = accomplishment - target
 *
 *   result > 0  -> Gain  (exceeded target)    reveals Notable Practice
 *   result < 0  -> Gap   (shortfall)          reveals Justification
 *   result = 0  -> Met   (exactly achieved)   reveals neither
 *
 * This is computed on read and never persisted. A stored variance can drift out
 * of agreement with the target and accomplishment it claims to summarise; a
 * derived one cannot.
 *
 * Physical and financial variance are evaluated INDEPENDENTLY. An activity that
 * over-delivers on headcount while underspending its budget legitimately shows a
 * Gain and a Gap at the same time, and each gets its own narrative field.
 */

export type VarianceOutcome = "GAIN" | "GAP" | "MET";

/** Which narrative field the form should reveal for this dimension. */
export type NarrativeField = "notablePractice" | "justification" | null;

export interface Variance {
  target: number;
  accomplishment: number;
  /** accomplishment - target */
  result: number;
  outcome: VarianceOutcome;
  /** Percentage of target achieved. `null` when target is 0 (undefined ratio). */
  achievementRate: number | null;
  /** The field the UI must show and require for this dimension. */
  requiredNarrative: NarrativeField;
}

/**
 * Accepts `Decimal | number | string | null` as stored by Prisma and normalises
 * to a JS number. Prisma returns Decimal objects for `@db.Decimal` columns, and
 * those stringify correctly but do not arithmetic correctly.
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(
    typeof value === "object" && value !== null && "toString" in value
      ? (value as { toString(): string }).toString()
      : value,
  );
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Rounds to 2dp to absorb binary-float drift. Without this, a target of 0.1+0.2
 * against an accomplishment of 0.3 reports a Gap of -5.55e-17 instead of Met.
 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function classify(result: number): VarianceOutcome {
  if (result > 0) return "GAIN";
  if (result < 0) return "GAP";
  return "MET";
}

export function narrativeFor(outcome: VarianceOutcome): NarrativeField {
  if (outcome === "GAIN") return "notablePractice";
  if (outcome === "GAP") return "justification";
  return null;
}

/**
 * Computes variance for one dimension. Returns `null` when either side is
 * missing — an unreported accomplishment is not a Gap of the full target, it is
 * simply not yet reported, and conflating the two would invent shortfalls.
 */
export function computeVariance(
  target: unknown,
  accomplishment: unknown,
): Variance | null {
  const t = toNumber(target);
  const a = toNumber(accomplishment);
  if (t === null || a === null) return null;

  const result = round2(a - t);
  const outcome = classify(result);

  return {
    target: t,
    accomplishment: a,
    result,
    outcome,
    achievementRate: t === 0 ? null : round2((a / t) * 100),
    requiredNarrative: narrativeFor(outcome),
  };
}

export interface ActivityVariance {
  physical: Variance | null;
  financial: Variance | null;
}

export function computeActivityVariance(activity: {
  physicalTarget: unknown;
  physicalAccomplishment: unknown;
  financialTarget: unknown;
  financialAccomplishment: unknown;
}): ActivityVariance {
  return {
    physical: computeVariance(
      activity.physicalTarget,
      activity.physicalAccomplishment,
    ),
    financial: computeVariance(
      activity.financialTarget,
      activity.financialAccomplishment,
    ),
  };
}

export const OUTCOME_LABEL: Record<VarianceOutcome, string> = {
  GAIN: "Gain",
  GAP: "Gap",
  MET: "Met",
};

export const OUTCOME_DESCRIPTION: Record<VarianceOutcome, string> = {
  GAIN: "Exceeded the target",
  GAP: "Fell short of the target",
  MET: "Target exactly achieved",
};

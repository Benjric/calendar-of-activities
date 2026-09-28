import { STATUS_LABEL } from "@/lib/format";

type Status = keyof typeof STATUS_LABEL;

/**
 * Status is never carried by colour alone — every badge shows its word, and a
 * mark distinguishes the four at a glance for anyone who cannot separate the
 * hues.
 */
const MARK: Record<Status, string> = {
  PLANNED: "○",
  CONDUCTED: "●",
  RESCHEDULED: "→",
  DROPPED: "×",
};

/*
 * Each status owns an explicit border rather than a tint of its own text
 * colour: a 25% wash of the label reads as the same grey on all four and
 * loses the distinction the badge exists to make.
 *
 * Rescheduled is dashed as well as amber — a date that has moved is the one
 * state worth spotting without reading, and the dash says "provisional" where
 * hue alone would not.
 */
const STYLE: Record<Status, string> = {
  PLANNED:
    "text-[var(--status-planned)] bg-[var(--status-planned-bg)] border-[var(--status-planned-border)]",
  CONDUCTED:
    "text-[var(--status-conducted)] bg-[var(--status-conducted-bg)] border-[var(--status-conducted-border)]",
  RESCHEDULED:
    "text-[var(--status-rescheduled)] bg-[var(--status-rescheduled-bg)] border-dashed border-[var(--status-rescheduled-border)]",
  DROPPED:
    "text-[var(--status-dropped)] bg-[var(--status-dropped-bg)] border-[var(--status-dropped-border)]",
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STYLE[status]} ${className}`}
    >
      <span aria-hidden="true">{MARK[status]}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

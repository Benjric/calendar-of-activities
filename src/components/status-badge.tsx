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

const STYLE: Record<Status, string> = {
  PLANNED:
    "text-[var(--status-planned)] bg-[var(--status-planned-bg)] border-[var(--status-planned)]/25",
  CONDUCTED:
    "text-[var(--status-conducted)] bg-[var(--status-conducted-bg)] border-[var(--status-conducted)]/25",
  RESCHEDULED:
    "text-[var(--status-rescheduled)] bg-[var(--status-rescheduled-bg)] border-[var(--status-rescheduled)]/25",
  DROPPED:
    "text-[var(--status-dropped)] bg-[var(--status-dropped-bg)] border-[var(--status-dropped)]/25",
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
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STYLE[status]} ${className}`}
    >
      <span aria-hidden="true">{MARK[status]}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

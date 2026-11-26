import { formatDateRange } from "@/lib/format";
import type { ConflictResult } from "@/lib/conflicts";

/**
 * A conflict is shown, never enforced. Every one of the three checks offers a
 * way through, because concurrent activities, shared venues and double-booked
 * staff are all sometimes intentional. Proceeding records who accepted it.
 *
 * Unaccepted, it arrives and shakes once so it cannot be read past. Accepted,
 * it settles into a quieter "override recorded" note that can still be undone.
 */

const KIND_TITLE = {
  DATE: "These dates are already booked",
  VENUE: "This venue is already booked",
  PARTICIPANT: "Participants are already committed",
} as const;

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[22px] shrink-0">
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  );
}

export function ConflictAlert({
  conflict,
  acknowledged,
  onAcknowledge,
  onRevise,
  reviseLabel,
}: {
  conflict: ConflictResult;
  acknowledged: boolean;
  onAcknowledge?: (kind: ConflictResult["kind"], value: boolean) => void;
  /** Optional way out other than continuing, e.g. "Choose another venue". */
  onRevise?: () => void;
  reviseLabel?: string;
}) {
  if (acknowledged && onAcknowledge) {
    return (
      <div className="anim-pop flex items-start gap-3 rounded-[14px] border border-dashed border-[var(--status-rescheduled-border)] bg-[var(--status-rescheduled-wash)] px-4 py-3.5 text-[var(--status-rescheduled)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px size-5 shrink-0">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        <span className="min-w-0 flex-1 text-[15px] leading-normal">
          <strong>Override recorded.</strong> This booking will show that it
          went ahead over the {conflict.kind.toLowerCase()} conflict, and who
          approved it.
        </span>
        <button
          type="button"
          onClick={() => onAcknowledge(conflict.kind, false)}
          className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold underline underline-offset-2 transition-colors hover:bg-[var(--status-rescheduled-bg)]"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="anim-alert flex flex-col gap-3 rounded-[14px] border border-[var(--conflict-border)] bg-[var(--conflict-bg)] px-[18px] py-4"
    >
      <div className="flex gap-3 text-[var(--conflict-text)]">
        <WarnIcon />
        <div className="flex min-w-0 flex-col gap-1">
          <strong className="text-base">{KIND_TITLE[conflict.kind]}</strong>
          <span className="text-[15px] leading-normal">{conflict.message}</span>
        </div>
      </div>

      {conflict.activities.length > 0 && (
        <ul className="flex flex-col gap-1.5 sm:pl-[34px]">
          {conflict.activities.map((a) => (
            <li
              key={a.id}
              className="rounded-[10px] border border-[var(--conflict-border)] bg-card/80 px-3 py-2 text-sm"
            >
              <span className="font-semibold">{a.title}</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground tabular-nums">
                {formatDateRange(a.startDate, a.endDate)}
                {a.venueName && ` · ${a.venueName}`}
                {a.leadDivisionName && ` · ${a.leadDivisionName}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {conflict.affectedPeople && conflict.affectedPeople.length > 0 && (
        <p className="text-sm text-[var(--conflict-text)] sm:pl-[34px]">
          <span className="font-semibold">Already committed:</span>{" "}
          {conflict.affectedPeople.map((p) => p.fullName).join(", ")}
        </p>
      )}

      {onAcknowledge && (
        <div className="flex flex-wrap gap-2 sm:pl-[34px]">
          {onRevise && reviseLabel && (
            <button
              type="button"
              onClick={onRevise}
              className="press min-h-11 rounded-[10px] border border-[var(--conflict-border)] bg-card px-4 text-[15px] font-semibold text-[var(--conflict-text)] transition-colors hover:bg-[#f6d6ca]"
            >
              {reviseLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => onAcknowledge(conflict.kind, true)}
            className="press min-h-11 rounded-[10px] bg-[var(--conflict)] px-4 text-[15px] font-semibold text-white transition-[filter] hover:brightness-95"
          >
            Continue anyway
          </button>
        </div>
      )}
    </div>
  );
}

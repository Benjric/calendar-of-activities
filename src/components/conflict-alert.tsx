import { formatDateRange } from "@/lib/format";
import type { ConflictResult } from "@/lib/conflicts";

/**
 * A conflict is shown, never enforced. Every one of the three checks offers a
 * way through, because concurrent activities, shared venues and double-booked
 * staff are all sometimes intentional. Proceeding records who accepted it.
 */

const KIND_TITLE = {
  DATE: "Date already booked",
  VENUE: "Venue already scheduled",
  PARTICIPANT: "Participants already committed",
} as const;

export function ConflictAlert({
  conflict,
  acknowledged,
  onAcknowledge,
}: {
  conflict: ConflictResult;
  acknowledged: boolean;
  onAcknowledge?: (kind: ConflictResult["kind"], value: boolean) => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-[var(--conflict)]/35 bg-[var(--conflict-bg)] p-3.5"
    >
      <div className="flex items-start gap-2.5">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-[var(--conflict)]"
        >
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>

        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-[var(--conflict)]">
            {KIND_TITLE[conflict.kind]}
          </h4>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">
            {conflict.message}
          </p>

          <ul className="mt-2.5 space-y-1.5">
            {conflict.activities.map((a) => (
              <li
                key={a.id}
                className="rounded-md border border-[var(--conflict)]/20 bg-card/70 px-2.5 py-1.5 text-[12px]"
              >
                <span className="font-medium">{a.title}</span>
                <span className="mt-0.5 block font-mono text-muted-foreground tabular-nums">
                  {formatDateRange(a.startDate, a.endDate)}
                  {a.venueName && ` · ${a.venueName}`}
                  {a.leadDivisionName && ` · ${a.leadDivisionName}`}
                </span>
              </li>
            ))}
          </ul>

          {conflict.affectedPeople && conflict.affectedPeople.length > 0 && (
            <p className="mt-2 text-[12px] text-foreground/75">
              <span className="font-medium">Already committed:</span>{" "}
              {conflict.affectedPeople.map((p) => p.fullName).join(", ")}
            </p>
          )}

          {onAcknowledge && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-[var(--conflict)]/25 bg-card/60 px-2.5 py-2 text-[13px]">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) =>
                  onAcknowledge(conflict.kind, e.currentTarget.checked)
                }
                className="mt-0.5 size-4 accent-[var(--conflict)]"
              />
              <span>
                <span className="font-medium">Continue anyway.</span>{" "}
                <span className="text-muted-foreground">
                  This decision is recorded against the activity.
                </span>
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

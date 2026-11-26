import { formatDate } from "@/lib/format";

/**
 * Completion Report and Means of Verification for one activity.
 *
 * The Completion Report is singled out rather than listed as another file:
 * it is the document the accomplishment figures are answerable to, and a
 * report that was never uploaded is a different situation from one MOV
 * missing among several.
 */

const KIND_LABEL = {
  COMPLETION_REPORT: "Completion Report",
  MOV: "MOV",
  OTHER: "Other",
} as const;


type Kind = keyof typeof KIND_LABEL;

export interface AttachmentItem {
  id: string;
  kind: Kind;
  fileName: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: Date;
}

/** Bytes as the uploader would describe them, not as the disk stores them. */
function fileSize(bytes: number | null): string | null {
  if (bytes === null || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function FileIcon({ image, report }: { image: boolean; report: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-[38px] shrink-0 place-items-center rounded-[9px] ${
        report
          ? "bg-[var(--avatar-bg)] text-primary"
          : "bg-[var(--status-conducted-bg)] text-[var(--status-conducted)]"
      }`}
    >
      {image ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="m21 16-5-5-9 9" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5" />
          {!report && <path d="M9 14l2 2 4-4" />}
        </svg>
      )}
    </span>
  );
}

export function AttachmentList({ items }: { items: AttachmentItem[] }) {
  const hasReport = items.some((a) => a.kind === "COMPLETION_REPORT");

  return (
    <section className="surface flex flex-col gap-3.5 px-6 py-[22px]">
      <h2 className="text-[19px]">
        Completion Report and MOVs{" "}
        <span className="text-[var(--faint-foreground)] tabular-nums">· {items.length}</span>
      </h2>

      {items.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-[var(--input)] bg-[var(--outside-bg)] px-4 py-6 text-center text-[15px] text-muted-foreground">
          Nothing uploaded yet.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border">
          {items.map((a, i) => {
            const size = fileSize(a.sizeBytes);
            return (
              <li
                key={a.id}
                className={`anim-up flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[var(--header-bg)] ${i ? "border-t border-[var(--meter-track)]" : ""}`}
                style={{ animationDelay: `${(0.15 + i * 0.05).toFixed(2)}s` }}
              >
                <FileIcon
                  image={Boolean(a.mimeType?.startsWith("image/"))}
                  report={a.kind === "COMPLETION_REPORT"}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-semibold hover:text-primary hover:underline"
                  >
                    {a.fileName}
                  </a>
                  <span className="text-[13px] text-muted-foreground">
                    {[KIND_LABEL[a.kind], size, formatDate(a.uploadedAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && !hasReport && (
        <p className="rounded-[10px] border border-dashed border-[var(--status-rescheduled-border)] bg-[var(--status-rescheduled-wash)] px-3.5 py-2.5 text-sm text-[var(--status-rescheduled)]">
          No Completion Report among these files.
        </p>
      )}
    </section>
  );
}

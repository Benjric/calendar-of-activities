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

const KIND_STYLE = {
  COMPLETION_REPORT: "bg-foreground text-background",
  MOV: "bg-[var(--subtle)] text-foreground",
  OTHER: "bg-[var(--subtle)] text-muted-foreground",
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

function FileIcon({ image }: { image: boolean }) {
  return image ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5.5 shrink-0 text-muted-foreground">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5.5 shrink-0 text-muted-foreground">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export function AttachmentList({ items }: { items: AttachmentItem[] }) {
  const hasReport = items.some((a) => a.kind === "COMPLETION_REPORT");

  return (
    <section className="surface overflow-hidden">
      <h2 className="eyebrow border-b border-[var(--grid-line)] px-4 py-2.5">
        Completion Report &amp; MOVs · {items.length}
      </h2>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
          Nothing uploaded yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--grid-line)]">
          {items.map((a) => {
            const size = fileSize(a.sizeBytes);
            return (
              <li key={a.id} className="flex items-center gap-3.5 px-4 py-3">
                <FileIcon image={Boolean(a.mimeType?.startsWith("image/"))} />
                <span className="min-w-0 flex-1">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-semibold hover:underline"
                  >
                    {a.fileName}
                  </a>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {[size, formatDate(a.uploadedAt)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${KIND_STYLE[a.kind]}`}
                >
                  {KIND_LABEL[a.kind]}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && !hasReport && (
        <p className="border-t border-[var(--grid-line)] bg-[var(--status-rescheduled-bg)] px-4 py-2.5 text-[13px] text-[var(--status-rescheduled)]">
          No Completion Report among these files.
        </p>
      )}
    </section>
  );
}

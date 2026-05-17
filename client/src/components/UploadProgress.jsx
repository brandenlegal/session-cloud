import { formatFileSize } from "../lib/formatBytes.js";

/** @param {{ name: string, size: number, progress: number, status: string, error?: string, onCancel?: () => void }} props */
export function UploadProgress({
  name,
  size,
  progress,
  status,
  error,
  onCancel,
}) {
  const showBar = status === "uploading" || status === "pending";
  const pct = status === "success" ? 100 : progress;

  return (
    <div className="rounded-xl border border-border bg-surface-2/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-fg">{name}</p>
          <p className="mt-0.5 text-xs text-muted">{formatFileSize(size)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status === "uploading" && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:border-red-500/40 hover:text-red-300"
            >
              Cancel
            </button>
          ) : null}
          {status === "success" ? (
            <span className="text-sm text-cyan-400" aria-label="Success">
              ✓
            </span>
          ) : null}
          {status === "error" ? (
            <span className="text-sm text-red-400" aria-label="Error">
              ✕
            </span>
          ) : null}
          {status === "cancelled" ? (
            <span className="text-xs text-muted">Cancelled</span>
          ) : null}
        </div>
      </div>

      {showBar || status === "success" ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-linear-to-r from-cyan-600 to-cyan-400 transition-[width] duration-150 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-muted">{pct}%</p>
        </div>
      ) : null}

      {status === "error" && error ? (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

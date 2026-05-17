import { useState } from "react";
import { formatFileSize } from "../lib/formatBytes.js";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = /\.(wav|mp3|flac|m4a|aac)$/i;

/** @param {{ disabled?: boolean, onFilesAdded: (files: File[]) => void }} props */
export function FileDropzone({ disabled, onFilesAdded }) {
  const [dragOver, setDragOver] = useState(false);

  function validateAndEmit(list) {
    const files = Array.from(list ?? []).filter(Boolean);
    const ok = [];
    for (const f of files) {
      if (!ALLOWED.test(f.name)) continue;
      if (f.size > MAX_BYTES) continue;
      ok.push(f);
    }
    if (ok.length) onFilesAdded(ok);
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (!disabled) validateAndEmit(e.dataTransfer.files);
      }}
      className={`rounded-2xl border-2 border-dashed px-4 py-12 text-center transition-all duration-200 ${
        dragOver
          ? "border-cyan-400 bg-cyan-950/25 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
          : "border-border bg-surface-2/40 hover:border-cyan-500/50"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <input
        type="file"
        accept=".wav,.mp3,.flac,.m4a,.aac,audio/*"
        multiple
        disabled={disabled}
        className="sr-only"
        id="file-drop-input"
        onChange={(e) => validateAndEmit(e.target.files)}
      />
      <label
        htmlFor="file-drop-input"
        className="flex cursor-pointer flex-col items-center gap-3"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500/15 text-2xl text-cyan-400">
          ♪
        </div>
        <div>
          <p className="text-lg font-semibold text-fg">
            Drop audio files here or browse
          </p>
          <p className="mt-1 text-sm text-muted">
            WAV, MP3, FLAC, M4A, AAC — max {formatFileSize(MAX_BYTES)} each
          </p>
        </div>
        <span className="inline-flex min-h-11 min-w-[8rem] items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-950/30 px-4 py-2.5 text-sm font-medium text-cyan-300 transition active:scale-[0.98]">
          Choose files
        </span>
      </label>
    </div>
  );
}

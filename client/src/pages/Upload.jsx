import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";
import { FileDropzone } from "../components/FileDropzone.jsx";
import { UploadProgress } from "../components/UploadProgress.jsx";
import { uploadTrack } from "../lib/api.js";
import { formatFileSize } from "../lib/formatBytes.js";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = /\.(wav|mp3|flac|m4a|aac)$/i;

function makeId() {
  return crypto.randomUUID();
}

export default function Upload() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const abortMapRef = useRef(new Map());

  const addFiles = useCallback((incoming) => {
    let skipped = 0;
    const next = [];
    for (const f of incoming) {
      if (!ALLOWED.test(f.name)) {
        skipped++;
        continue;
      }
      if (f.size > MAX_BYTES) {
        skipped++;
        continue;
      }
      next.push({
        id: makeId(),
        file: f,
        progress: 0,
        status: "pending",
        controller: null,
      });
    }
    if (skipped) {
      toast.error(
        `${skipped} file(s) skipped (invalid type or over ${formatFileSize(MAX_BYTES)})`,
      );
    }
    if (next.length) {
      setItems((prev) => [...prev, ...next]);
    }
  }, []);

  const removeItem = useCallback((id) => {
    abortMapRef.current.get(id)?.abort();
    abortMapRef.current.delete(id);
    setItems((prev) => {
      const row = prev.find((r) => r.id === id);
      row?.controller?.abort();
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      for (const r of prev) {
        r.controller?.abort();
        abortMapRef.current.get(r.id)?.abort();
        abortMapRef.current.delete(r.id);
      }
      return [];
    });
  }, []);

  const uploadAll = useCallback(async () => {
    const queue = items.filter((r) => r.status === "pending");
    if (!queue.length) {
      toast.error("Add files to upload first.");
      return;
    }
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const row of queue) {
      const controller = new AbortController();
      abortMapRef.current.set(row.id, controller);
      setItems((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, status: "uploading", progress: 0, controller }
            : r,
        ),
      );
      try {
        await uploadTrack(row.file, {
          signal: controller.signal,
          onProgress: (pct) => {
            setItems((prev) =>
              prev.map((r) =>
                r.id === row.id ? { ...r, progress: pct } : r,
              ),
            );
          },
        });
        ok++;
        setItems((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, status: "success", progress: 100, controller: null }
              : r,
          ),
        );
        toast.success(`Uploaded: ${row.file.name}`);
      } catch (e) {
        if (axios.isCancel?.(e) || e.code === "ERR_CANCELED") {
          setItems((prev) =>
            prev.map((r) =>
              r.id === row.id
                ? { ...r, status: "cancelled", controller: null }
                : r,
            ),
          );
          abortMapRef.current.delete(row.id);
          continue;
        }
        fail++;
        const msg =
          e.response?.data?.error ?? e.message ?? "Upload failed";
        setItems((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  status: "error",
                  error: msg,
                  controller: null,
                }
              : r,
          ),
        );
        toast.error(`${row.file.name}: ${msg}`);
      }
      abortMapRef.current.delete(row.id);
    }
    setBusy(false);
    if (ok && !fail) {
      toast.success("All uploads completed");
      navigate("/library", { replace: true });
    }
  }, [items, navigate]);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Upload</h1>
          <p className="mt-1 text-sm text-muted">
            Add session audio to your cloud library
          </p>
        </div>
        <Link
          to="/library"
          className="text-sm font-medium text-cyan-400 underline-offset-4 hover:underline"
        >
          Back to library
        </Link>
      </header>

      <FileDropzone disabled={busy} onFilesAdded={addFiles} />

      {items.length > 0 ? (
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Queue ({items.length})
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={clearAll}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
              >
                Clear all
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={uploadAll}
                className="rounded-lg bg-linear-to-r from-cyan-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-900/30 transition hover:brightness-110 disabled:opacity-50"
              >
                {busy ? "Uploading…" : "Upload all"}
              </button>
            </div>
          </div>
          <ul className="space-y-3">
            {items.map((row) => (
              <li key={row.id} className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <UploadProgress
                    name={row.file.name}
                    size={row.file.size}
                    progress={row.progress}
                    status={row.status}
                    error={row.error}
                    onCancel={
                      row.status === "uploading"
                        ? () => abortMapRef.current.get(row.id)?.abort()
                        : undefined
                    }
                  />
                </div>
                {row.status === "pending" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeItem(row.id)}
                    className="self-start rounded-md border border-border px-2 py-1 text-xs text-muted hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

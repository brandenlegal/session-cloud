import { useCallback, useEffect, useMemo, useState } from "react";
import { getTracks } from "../lib/api.js";
import { trackDisplayName } from "../lib/trackDisplayName.js";

export default function AddTrackToProjectModal({
  open,
  projectId,
  onClose,
  onAdd,
  /** Track ids already in this project (shown checked/disabled) */
  memberIds = [],
}) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getTracks({ sort: "name", order: "asc" });
      setTracks(list ?? []);
    } catch (e) {
      setError(e.response?.data?.error ?? "Could not load tracks");
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setOnlyUnassigned(false);
    setSelected(new Set());
    void load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tracks.filter((t) => {
      if (onlyUnassigned && t.projectId != null) return false;
      if (!q) return true;
      return trackDisplayName(t).toLowerCase().includes(q);
    });
  }, [tracks, onlyUnassigned, search]);

  function toggle(id) {
    if (memberSet.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    const ids = [...selected].filter((id) => !memberSet.has(id));
    if (!ids.length) {
      setError("Select at least one track to add.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onAdd(ids);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error ?? e.message ?? "Add failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col rounded-2xl border border-cyan-500/25 bg-[oklch(0.17_0.05_250)] shadow-2xl"
        role="dialog"
        aria-labelledby="add-tracks-title"
      >
        <div className="shrink-0 border-b border-border p-5">
          <h2
            id="add-tracks-title"
            className="text-lg font-semibold text-fg"
          >
            Add tracks to project
          </h2>
          <p className="mt-1 text-xs text-muted">
            Tracks already in this project are marked. Selecting others moves
            them into this project.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none ring-cyan-500/30 focus:ring-2"
            />
            <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={onlyUnassigned}
                onChange={(e) => setOnlyUnassigned(e.target.checked)}
                className="rounded border-border"
              />
              Unassigned only
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No tracks match this filter.
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((t) => {
                const inProject = memberSet.has(t.id);
                const checked = inProject || selected.has(t.id);
                return (
                  <li key={t.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition ${
                        inProject
                          ? "opacity-60"
                          : "hover:bg-cyan-500/10"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-border"
                        checked={checked}
                        disabled={inProject}
                        onChange={() => toggle(t.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-fg">
                          {trackDisplayName(t)}
                        </span>
                        <span className="text-xs text-muted">
                          {t.project?.name
                            ? `In: ${t.project.name}`
                            : "Unassigned"}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-4">
          {error ? (
            <p className="mb-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:border-cyan-500/40 hover:text-fg disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={submitting || loading}
              className="rounded-lg bg-linear-to-r from-cyan-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add selected"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

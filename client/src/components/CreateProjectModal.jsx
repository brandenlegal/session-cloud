import { useEffect, useState } from "react";

const NAME_MAX = 200;
const DESC_MAX = 2000;

export default function CreateProjectModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setError("");
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setError("Project name is required.");
      return;
    }
    if (n.length > NAME_MAX) {
      setError(`Name must be at most ${NAME_MAX} characters.`);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onCreate({
        name: n,
        description: description.trim() || undefined,
      });
    } catch (err) {
      setError(
        err.response?.data?.error ??
          err.message ??
          "Could not create project.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm transition-opacity"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-cyan-500/25 bg-[oklch(0.18_0.05_250)] p-6 shadow-2xl shadow-cyan-950/40"
        role="dialog"
        aria-labelledby="create-project-title"
      >
        <h2
          id="create-project-title"
          className="text-lg font-semibold tracking-tight text-fg"
        >
          Create project
        </h2>
        <p className="mt-1 text-sm text-muted">
          Albums, EPs, playlists, or session folders — organize your library.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-fg outline-none ring-cyan-500/30 focus:ring-2"
              placeholder="e.g. Debut album"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted">
              Description <span className="text-muted/70">(optional)</span>
            </label>
            <textarea
              value={description}
              maxLength={DESC_MAX}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none ring-cyan-500/30 focus:ring-2"
              placeholder="Notes for this collection…"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-cyan-500/40 hover:text-fg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-linear-to-r from-cyan-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-900/30 transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api, {
  deleteTrack,
  getProjects,
  getShares,
  getTracks,
  updateTrack,
} from "../lib/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { isAuthenticated } from "../lib/auth.js";
import { formatFileSize } from "../lib/formatBytes.js";
import { trackDisplayName } from "../lib/trackDisplayName.js";
import ShareModal from "../components/ShareModal.jsx";
import ManageSharesModal from "../components/ManageSharesModal.jsx";
import { PageSkeleton } from "../components/PageSkeleton.jsx";
import {
  usePlayerCommands,
  usePlayerMeta,
} from "../context/PlayerContext.jsx";

function formatDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return "—";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function shareIsActive(s) {
  if (!s.expiresAt) return true;
  return new Date(s.expiresAt) > new Date();
}

export default function Library() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { playTrack, stop, syncQueue } = usePlayerCommands();
  const { currentTrack, isPlaying } = usePlayerMeta();

  const [me, setMe] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [booting, setBooting] = useState(true);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [sort, setSort] = useState("date");
  const [order, setOrder] = useState("desc");
  /** "" = all, "unassigned", or project uuid */
  const [projectFilter, setProjectFilter] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkTarget, setBulkTarget] = useState("");
  const [allShares, setAllShares] = useState([]);
  const [shareTarget, setShareTarget] = useState(null);
  const [manageSharesOpen, setManageSharesOpen] = useState(false);

  const activeId = currentTrack?.id ?? null;
  const docked = Boolean(currentTrack);

  const projectFilterParam = useMemo(() => {
    if (!projectFilter) return undefined;
    if (projectFilter === "unassigned") return "unassigned";
    return projectFilter;
  }, [projectFilter]);

  const loadAllShares = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const list = await getShares();
      setAllShares(list ?? []);
    } catch {
      setAllShares([]);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const list = await getProjects({ sort: "name", order: "asc" });
      setProjects(list ?? []);
    } catch {
      /* optional — library still works */
      setProjects([]);
    }
  }, []);

  const loadTracks = useCallback(async () => {
    if (!isAuthenticated()) return;
    setTracksLoading(true);
    try {
      const list = await getTracks({
        sort,
        order,
        projectId: projectFilterParam,
      });
      setTracks(list ?? []);
      setSelected(new Set());
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Could not load tracks");
    } finally {
      setTracksLoading(false);
    }
  }, [sort, order, projectFilterParam]);

  useEffect(() => {
    syncQueue(tracks);
  }, [tracks, syncQueue]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login", { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/auth/me");
        if (!cancelled) setMe(data.user);
      } catch (e) {
        const status = e.response?.status;
        if (status === 401) {
          logout({ silent: true });
          navigate("/login", { replace: true });
          toast.error("Session expired. Please sign in again.");
        } else {
          toast.error(e.response?.data?.error ?? "Could not verify session");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, logout]);

  useEffect(() => {
    if (booting) return;
    void loadAllShares();
  }, [booting, loadAllShares]);

  useEffect(() => {
    if (booting) return;
    void loadProjects();
  }, [booting, loadProjects]);

  useEffect(() => {
    if (booting) return;
    void loadTracks();
  }, [booting, loadTracks]);

  const display = me ?? user;

  async function onDelete(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteTrack(id);
      toast.success("Track deleted");
      if (activeId === id) {
        stop();
      }
      await loadTracks();
      await loadProjects();
      await loadAllShares();
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Delete failed");
    }
  }

  function onPlay(t) {
    void playTrack(t, tracks);
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assignTrack(trackId, projectIdValue) {
    try {
      const body =
        projectIdValue === "" || projectIdValue == null
          ? { projectId: null }
          : { projectId: projectIdValue };
      await updateTrack(trackId, body);
      toast.success(
        body.projectId ? "Added to project" : "Removed from project",
      );
      await loadTracks();
      await loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Update failed");
    }
  }

  async function applyBulkMove() {
    if (!selected.size) {
      toast.error("Select one or more tracks.");
      return;
    }
    if (!bulkTarget) {
      toast.error('Choose "No project" or a project, then click Apply.');
      return;
    }
    const target = bulkTarget === "__none__" ? null : bulkTarget;
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => updateTrack(id, { projectId: target })));
      toast.success(
        target
          ? `Moved ${ids.length} track(s) to project`
          : `Unassigned ${ids.length} track(s)`,
      );
      setSelected(new Set());
      setBulkTarget("");
      await loadTracks();
      await loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Bulk move failed");
    }
  }

  const selectionCount = selected.size;

  if (booting && !display) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div
      className={`mx-auto min-h-dvh max-w-3xl px-4 py-10 ${docked ? "pb-52 md:pb-56" : ""}`}
    >
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Library</h1>
          <p className="mt-1 text-sm text-muted">
            Signed in as{" "}
            <span className="font-medium text-cyan-400">{display?.username}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setManageSharesOpen(true)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-cyan-500/40 hover:text-fg"
          >
            Share links
          </button>
          <Link
            to="/projects"
            className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
          >
            Projects
          </Link>
          <Link
            to="/upload"
            className="rounded-lg bg-linear-to-r from-cyan-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-900/30 transition hover:brightness-110"
          >
            Upload
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-cyan-500/40 hover:text-fg"
          >
            Home
          </Link>
          <button
            type="button"
            onClick={() => {
              stop();
              logout();
              navigate("/login", { replace: true });
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-red-500/40 hover:text-red-300"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-fg"
          >
            <option value="date">Date</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Order
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-fg"
          >
            <option value="desc">Newest / Z–A</option>
            <option value="asc">Oldest / A–Z</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Project
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="max-w-[200px] rounded-lg border border-border bg-surface px-2 py-1 text-fg"
          >
            <option value="">All tracks</option>
            <option value="unassigned">Unassigned only</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {tracksLoading ? (
          <span className="text-xs text-muted">Refreshing…</span>
        ) : null}
      </div>

      {selectionCount > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3 text-sm">
          <span className="font-medium text-fg">
            {selectionCount} selected
          </span>
          <label className="flex items-center gap-2 text-muted">
            Move to
            <select
              value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-fg"
            >
              <option value="">Choose…</option>
              <option value="__none__">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void applyBulkMove()}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted underline-offset-2 hover:underline"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {tracksLoading && tracks.length === 0 ? (
        <PageSkeleton label="Loading library" />
      ) : tracks.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-2/50 px-4 py-8 text-center text-sm text-muted">
          No tracks yet.{" "}
          <Link to="/upload" className="text-cyan-400 underline-offset-4 hover:underline">
            Upload audio
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface-2/40">
          {tracks.map((t) => {
            const isActive = activeId === t.id;
            const label = trackDisplayName(t);
            const hasPublicShare = allShares.some(
              (s) => s.trackId === t.id && shareIsActive(s),
            );
            return (
              <li
                key={t.id}
                className={`flex flex-col gap-3 px-4 py-3 transition sm:flex-row sm:items-center sm:justify-between ${
                  isActive
                    ? "bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/25"
                    : ""
                }`}
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleSelected(t.id)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                    aria-label={`Select ${label}`}
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onPlay(t)}
                      className="block w-full truncate text-left font-medium text-fg hover:text-cyan-300"
                    >
                      {label}
                      {hasPublicShare ? (
                        <span
                          className="ml-2 inline-flex items-center rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300"
                          title="Public share link active"
                        >
                          Shared
                        </span>
                      ) : null}
                      {isActive ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                          {isPlaying ? "Now playing" : "Paused"}
                        </span>
                      ) : null}
                    </button>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      {t.project ? (
                        <Link
                          to={`/projects/${t.project.id}`}
                          className="inline-flex items-center rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 font-medium text-cyan-200 hover:border-cyan-400/60"
                        >
                          {t.project.name}
                        </Link>
                      ) : (
                        <span className="text-muted/80">No project</span>
                      )}
                      <span>
                        {t.format.toUpperCase()} · {formatFileSize(t.filesize)}{" "}
                        · {formatDuration(t.duration)}
                        {t.bitrate != null ? ` · ${t.bitrate} kbps` : ""} ·{" "}
                        {new Date(t.uploadedAt).toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <span className="hidden sm:inline">Project</span>
                    <select
                      value={t.projectId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        void assignTrack(t.id, v);
                      }}
                      className="max-w-[140px] rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-fg"
                    >
                      <option value="">— None —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setShareTarget({
                        mode: "track",
                        id: t.id,
                        label,
                      })
                    }
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-cyan-500/40 hover:text-cyan-200"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={() => onPlay(t)}
                    className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(t.id, label)}
                    className="rounded-md border border-border px-2 py-1.5 text-xs text-red-300 hover:border-red-500/50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ShareModal
        open={shareTarget != null}
        onClose={() => setShareTarget(null)}
        mode={shareTarget?.mode ?? "track"}
        resourceId={shareTarget?.id ?? ""}
        resourceLabel={shareTarget?.label ?? ""}
        onChanged={() => void loadAllShares()}
      />
      <ManageSharesModal
        open={manageSharesOpen}
        onClose={() => setManageSharesOpen(false)}
        onChanged={() => void loadAllShares()}
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  addTracksToProject,
  deleteProject,
  getProject,
  getShares,
  removeTrackFromProject,
  updateProject,
} from "../lib/api.js";
import ShareModal from "../components/ShareModal.jsx";
import { trackDisplayName } from "../lib/trackDisplayName.js";
import {
  usePlayerCommands,
  usePlayerMeta,
} from "../context/PlayerContext.jsx";
import AddTrackToProjectModal from "../components/AddTrackToProjectModal.jsx";

function formatDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return "—";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const NAME_MAX = 200;
const DESC_MAX = 2000;

function shareIsActive(s) {
  if (!s.expiresAt) return true;
  return new Date(s.expiresAt) > new Date();
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playTrack, syncQueue } = usePlayerCommands();
  const { currentTrack, isPlaying } = usePlayerMeta();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [shares, setShares] = useState([]);
  const [shareProjectOpen, setShareProjectOpen] = useState(false);

  const loadShares = useCallback(async () => {
    try {
      const list = await getShares();
      setShares(list ?? []);
    } catch {
      setShares([]);
    }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await getProject(id);
      setProject(p);
      setNameDraft(p.name ?? "");
      setDescDraft(p.description ?? "");
    } catch (e) {
      const st = e.response?.status;
      if (st === 404) {
        toast.error("Project not found");
        navigate("/projects", { replace: true });
      } else {
        toast.error(e.response?.data?.error ?? "Could not load project");
      }
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!project || !id) return;
    void loadShares();
  }, [project, id, loadShares]);

  const tracks = project?.tracks ?? [];

  useEffect(() => {
    if (tracks.length) syncQueue(tracks);
  }, [tracks, syncQueue]);

  async function saveName(next) {
    if (!project || !id) return;
    const n = next.trim();
    if (!n || n.length > NAME_MAX) {
      toast.error("Invalid project name");
      setNameDraft(project.name);
      return;
    }
    if (n === project.name) return;
    try {
      const updated = await updateProject(id, { name: n });
      setProject((prev) => (prev ? { ...prev, ...updated, tracks: prev.tracks } : prev));
      toast.success("Name saved");
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Save failed");
      setNameDraft(project.name);
    }
  }

  async function saveDescription(next) {
    if (!project || !id) return;
    const d = next.trim();
    if (d.length > DESC_MAX) {
      toast.error("Description too long");
      setDescDraft(project.description ?? "");
      return;
    }
    const prevDesc = project.description ?? "";
    if (d === prevDesc) return;
    try {
      const updated = await updateProject(id, { description: d || null });
      setProject((prev) => (prev ? { ...prev, ...updated, tracks: prev.tracks } : prev));
      toast.success("Description saved");
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Save failed");
      setDescDraft(prevDesc);
    }
  }

  async function handleDeleteProject() {
    if (!project || !id) return;
    if (
      !window.confirm(
        `Delete "${project.name}"? Tracks remain in your library.`,
      )
    ) {
      return;
    }
    try {
      await deleteProject(id);
      toast.success("Project deleted");
      navigate("/projects", { replace: true });
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Delete failed");
    }
  }

  async function handleRemoveTrack(trackId) {
    try {
      await removeTrackFromProject(trackId);
      toast.success("Removed from project");
      await load();
      await loadShares();
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Remove failed");
    }
  }

  const activeId = currentTrack?.id ?? null;

  if (loading && !project) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const memberIds = tracks.map((t) => t.id);
  const activeProjectShare = shares.some(
    (s) => s.projectId === id && shareIsActive(s),
  );

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10 pb-32">
      <Link
        to="/projects"
        className="text-sm text-cyan-400/90 underline-offset-4 hover:underline"
      >
        ← Back to projects
      </Link>

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={nameDraft}
            maxLength={NAME_MAX}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => void saveName(nameDraft)}
            className="w-full border-b border-transparent bg-transparent text-2xl font-bold tracking-tight text-fg outline-none transition placeholder:text-muted focus:border-cyan-500/50"
            aria-label="Project name"
          />
          <textarea
            value={descDraft}
            maxLength={DESC_MAX}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={() => void saveDescription(descDraft)}
            rows={2}
            placeholder="Description (optional)"
            className="mt-3 w-full resize-y rounded-lg border border-transparent bg-surface-2/30 px-2 py-2 text-sm text-muted outline-none transition focus:border-cyan-500/40 focus:text-fg"
            aria-label="Project description"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {activeProjectShare ? (
            <span className="text-center text-xs font-medium text-cyan-400 sm:text-right">
              Public link active
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShareProjectOpen(true)}
            className="shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
          >
            Share project
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteProject()}
            className="shrink-0 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
          >
            Delete project
          </button>
        </div>
      </header>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-fg">
            Tracks ({tracks.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
            >
              + Add tracks
            </button>
            {tracks.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void playTrack(tracks[0], tracks);
                    toast.success("Playing project");
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg transition hover:border-cyan-500/40"
                >
                  Play project
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void playTrack(tracks[0], tracks, { autoplay: false });
                    toast.success("Project loaded in queue");
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:border-cyan-500/40 hover:text-fg"
                >
                  Queue project
                </button>
              </>
            ) : null}
          </div>
        </div>

        {tracks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface-2/40 px-4 py-10 text-center text-sm text-muted">
            No tracks in this project yet. Use{" "}
            <button
              type="button"
              className="text-cyan-400 underline-offset-2 hover:underline"
              onClick={() => setAddOpen(true)}
            >
              Add tracks
            </button>{" "}
            to get started.
          </p>
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border bg-surface-2/40">
            {tracks.map((t, i) => {
              const isActive = activeId === t.id;
              return (
                <li
                  key={t.id}
                  className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    isActive ? "bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/20" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => void playTrack(t, tracks)}
                      className="block w-full truncate text-left font-medium text-fg hover:text-cyan-300"
                    >
                      <span className="text-muted">{i + 1}. </span>
                      {trackDisplayName(t)}
                      {isActive ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                          {isPlaying ? "Now playing" : "Paused"}
                        </span>
                      ) : null}
                    </button>
                    <p className="text-xs text-muted">
                      {formatDuration(t.duration)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void playTrack(t, tracks)}
                      className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200"
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveTrack(t.id)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:border-red-500/40 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <AddTrackToProjectModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        memberIds={memberIds}
        onAdd={async (trackIds) => {
          await addTracksToProject(id, trackIds);
          toast.success("Tracks added");
          await load();
          await loadShares();
        }}
      />

      <ShareModal
        open={shareProjectOpen}
        onClose={() => setShareProjectOpen(false)}
        mode="project"
        resourceId={id}
        resourceLabel={project.name}
        onChanged={() => void loadShares()}
      />
    </div>
  );
}

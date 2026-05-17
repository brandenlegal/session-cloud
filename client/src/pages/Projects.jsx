import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api, {
  createProject,
  deleteProject,
  getProjects,
} from "../lib/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { isAuthenticated } from "../lib/auth.js";
import CreateProjectModal from "../components/CreateProjectModal.jsx";
import { PageSkeleton } from "../components/PageSkeleton.jsx";

function truncate(s, max) {
  if (!s) return "";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export default function Projects() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [me, setMe] = useState(null);
  const [booting, setBooting] = useState(true);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("date");
  const [order, setOrder] = useState("desc");
  const [modalOpen, setModalOpen] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getProjects({ sort, order });
      setProjects(list ?? []);
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Could not load projects");
    } finally {
      setLoading(false);
    }
  }, [sort, order]);

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
    void loadProjects();
  }, [booting, loadProjects]);

  async function handleCreate(data) {
    const p = await createProject(data);
    toast.success("Project created");
    setModalOpen(false);
    navigate(`/projects/${p.id}`);
  }

  async function handleDelete(ev, id, name) {
    ev.preventDefault();
    ev.stopPropagation();
    if (
      !window.confirm(
        `Delete project "${name}"? Tracks stay in your library; they are only removed from this project.`,
      )
    ) {
      return;
    }
    try {
      await deleteProject(id);
      toast.success("Project deleted");
      await loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Delete failed");
    }
  }

  if (booting && !me) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 py-10 pb-32">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted">
            Organize tracks into albums, EPs, playlists, or sessions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-linear-to-r from-cyan-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-900/30 transition hover:brightness-110"
          >
            + Create project
          </button>
          <Link
            to="/library"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-cyan-500/40 hover:text-fg"
          >
            Library
          </Link>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
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
        {loading ? (
          <span className="text-xs text-muted">Refreshing…</span>
        ) : null}
      </div>

      {loading && projects.length === 0 ? (
        <PageSkeleton label="Loading projects" />
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cyan-500/30 bg-[oklch(0.16_0.05_260)] px-6 py-16 text-center">
          <p className="text-fg">
            No projects yet. Create one to organize your tracks.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-6 rounded-lg border border-cyan-500/50 px-5 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/15"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to={`/projects/${p.id}`}
                className="group block h-full rounded-xl border border-border bg-[oklch(0.16_0.06_260)] p-5 shadow-sm transition hover:border-cyan-400/50 hover:shadow-[0_0_0_1px_oklch(0.72_0.14_200/0.35)]"
              >
                <h2 className="text-lg font-semibold text-fg group-hover:text-cyan-200">
                  {p.name}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted">
                  {p.description
                    ? truncate(p.description, 140)
                    : "No description"}
                </p>
                <p className="mt-4 text-sm text-cyan-300/90">
                  {p.trackCount ?? 0}{" "}
                  {(p.trackCount ?? 0) === 1 ? "track" : "tracks"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Created{" "}
                  {new Date(p.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <div className="mt-4 flex gap-2">
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-200">
                    Open
                  </span>
                  <button
                    type="button"
                    onClick={(e) => void handleDelete(e, p.id, p.name)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-red-300 transition hover:border-red-500/50"
                  >
                    Delete
                  </button>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}

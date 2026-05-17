import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { buildSharePageUrl, getShares, revokeShare } from "../lib/api.js";

function isExpired(s) {
  if (!s.expiresAt) return false;
  return new Date(s.expiresAt) <= new Date();
}

export default function ManageSharesModal({ open, onClose, onChanged }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getShares();
      setShares(list ?? []);
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Could not load shares");
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    void load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = shares.map((s) => ({
      ...s,
      label:
        s.type === "track"
          ? s.trackName || "Track"
          : s.projectName || "Project",
    }));
    if (q) {
      rows = rows.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.token.toLowerCase().includes(q),
      );
    }
    rows.sort((a, b) => {
      if (sort === "views") {
        return (b.viewCount ?? 0) - (a.viewCount ?? 0);
      }
      if (sort === "expires") {
        const ae = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const be = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return ae - be;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return rows;
  }, [shares, search, sort]);

  async function copyLink(token) {
    const url = buildSharePageUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function onRevoke(id) {
    if (!window.confirm("Revoke this share link?")) return;
    try {
      await revokeShare(id);
      toast.success("Revoked");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Revoke failed");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-cyan-500/25 bg-[oklch(0.15_0.05_255)] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="text-lg font-semibold text-fg">Manage share links</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-fg"
          >
            Close
          </button>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-border px-5 py-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or token…"
            className="min-w-[200px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-fg"
            >
              <option value="date">Created</option>
              <option value="views">Views</option>
              <option value="expires">Expiration</option>
            </select>
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {loading ? (
            <p className="py-12 text-center text-sm text-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">
              {shares.length === 0
                ? "No share links yet."
                : "No matches for your search."}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="px-2 py-2">Content</th>
                  <th className="px-2 py-2">Link</th>
                  <th className="px-2 py-2">Created</th>
                  <th className="px-2 py-2">Expires</th>
                  <th className="px-2 py-2">Views</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-white/5 hover:bg-white/[0.03]"
                  >
                    <td className="px-2 py-2">
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-muted">
                        {s.type}
                      </span>
                      <div className="mt-1 font-medium text-fg">{s.label}</div>
                    </td>
                    <td className="max-w-[140px] px-2 py-2">
                      <div className="truncate font-mono text-xs text-muted">
                        {buildSharePageUrl(s.token)}
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyLink(s.token)}
                        className="mt-1 text-xs text-cyan-400 hover:underline"
                      >
                        Copy
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-muted">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs">
                      {isExpired(s) ? (
                        <span className="text-amber-400">Expired</span>
                      ) : s.expiresAt ? (
                        <span className="text-muted">
                          {new Date(s.expiresAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-muted">Never</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-fg">{s.viewCount ?? 0}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void onRevoke(s.id)}
                        className="text-xs text-red-300 hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

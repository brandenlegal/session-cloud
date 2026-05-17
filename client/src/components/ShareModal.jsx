import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  buildSharePageUrl,
  createShare,
  getShares,
  revokeShare,
} from "../lib/api.js";

function isShareActive(s) {
  if (!s.expiresAt) return true;
  return new Date(s.expiresAt) > new Date();
}

function qrDataUrl(pageUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pageUrl)}`;
}

export default function ShareModal({
  open,
  onClose,
  mode,
  resourceId,
  resourceLabel,
  onChanged,
}) {
  const [expiry, setExpiry] = useState("never");
  const [customDate, setCustomDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [shares, setShares] = useState([]);
  const [created, setCreated] = useState(null);

  const loadShares = useCallback(async () => {
    try {
      const list = await getShares();
      setShares(list ?? []);
    } catch {
      setShares([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    setExpiry("never");
    setCustomDate("");
    void loadShares();
  }, [open, loadShares]);

  const activeForResource = shares
    .filter((s) => {
      if (!isShareActive(s)) return false;
      if (mode === "track") return s.trackId === resourceId;
      return s.projectId === resourceId;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const primaryExisting = activeForResource[0] ?? null;

  async function handleGenerate() {
    if (!resourceId) return;
    let expiresIn = null;
    let expiresAt = null;
    if (expiry === "24") expiresIn = 24;
    else if (expiry === "168") expiresIn = 168;
    else if (expiry === "720") expiresIn = 720;
    else if (expiry === "custom") {
      if (!customDate) {
        toast.error("Pick an expiration date.");
        return;
      }
      const d = new Date(customDate);
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        toast.error("Expiration must be in the future.");
        return;
      }
      expiresAt = d.toISOString();
    }

    setBusy(true);
    try {
      const body = {
        type: mode,
        id: resourceId,
        ...(expiresAt != null ? { expiresAt } : {}),
        ...(expiresIn != null ? { expiresIn } : {}),
      };
      const share = await createShare(body);
      setCreated(share);
      toast.success("Share link created");
      await loadShares();
      onChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.error ?? e.message ?? "Could not create share");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(shareId) {
    if (!window.confirm("Revoke this link? It will stop working immediately.")) return;
    setBusy(true);
    try {
      await revokeShare(shareId);
      toast.success("Link revoked");
      setCreated(null);
      await loadShares();
      onChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy — copy manually");
    }
  }

  if (!open) return null;

  const displayShare = created ?? primaryExisting;
  const pageUrl = displayShare
    ? buildSharePageUrl(displayShare.token)
    : "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-cyan-500/25 bg-[oklch(0.16_0.05_255)] p-6 shadow-2xl"
        role="dialog"
        aria-labelledby="share-modal-title"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="share-modal-title" className="text-lg font-semibold text-fg">
            Share{" "}
            <span className="text-cyan-300/90">
              {resourceLabel || (mode === "track" ? "track" : "project")}
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-white/5 hover:text-fg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-xs text-muted">
          Anyone with the link can listen — no account required. Only this{" "}
          {mode === "track" ? "track" : "project"} is exposed.
        </p>

        <fieldset className="mt-6 space-y-2">
          <legend className="text-sm font-medium text-muted">Expires</legend>
          <div className="flex flex-col gap-2 text-sm">
            {[
              ["never", "Never"],
              ["24", "24 hours"],
              ["168", "7 days"],
              ["720", "30 days"],
              ["custom", "Custom…"],
            ].map(([val, label]) => (
              <label key={val} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="expiry"
                  value={val}
                  checked={expiry === val}
                  onChange={() => setExpiry(val)}
                  className="border-border text-cyan-500"
                />
                <span className="text-fg">{label}</span>
              </label>
            ))}
          </div>
          {expiry === "custom" ? (
            <input
              type="datetime-local"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg"
            />
          ) : null}
        </fieldset>

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleGenerate()}
          className="mt-6 w-full rounded-lg bg-linear-to-r from-cyan-600 to-cyan-500 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Working…" : "Generate share link"}
        </button>

        {displayShare ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Share link
            </p>
            <div className="mt-2 flex gap-2">
              <input
                readOnly
                value={pageUrl}
                className="min-w-0 flex-1 truncate rounded-lg border border-border bg-surface px-2 py-2 font-mono text-xs text-fg"
              />
              <button
                type="button"
                onClick={() => void copyText(pageUrl)}
                className="shrink-0 rounded-lg border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10"
              >
                Copy
              </button>
            </div>
            <div className="mt-4 flex flex-col items-center gap-2">
              <img
                src={qrDataUrl(pageUrl)}
                alt="QR code for this share link"
                loading="lazy"
                decoding="async"
                width={180}
                height={180}
                className="rounded-lg border border-white/10 bg-white p-1"
              />
              <p className="text-[10px] text-muted">Scan to open on mobile</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
              <div>
                <dt className="text-muted/70">Views</dt>
                <dd className="font-medium text-fg">{displayShare.viewCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted/70">Expires</dt>
                <dd className="font-medium text-fg">
                  {displayShare.expiresAt
                    ? new Date(displayShare.expiresAt).toLocaleString()
                    : "Never"}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRevoke(displayShare.id)}
              className="mt-4 w-full rounded-lg border border-red-500/40 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              Revoke link
            </button>
          </div>
        ) : null}

        {activeForResource.length > 1 ? (
          <p className="mt-3 text-xs text-muted">
            You have {activeForResource.length} active links for this{" "}
            {mode === "track" ? "track" : "project"}. Revoking removes only the
            link shown above; generate again for another link.
          </p>
        ) : null}
      </div>
    </div>
  );
}

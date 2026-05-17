import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicShare } from "../lib/api.js";
import { trackDisplayName } from "../lib/trackDisplayName.js";
import { formatFileSize } from "../lib/formatBytes.js";
import { usePublicSharePlayer } from "../hooks/usePublicSharePlayer.js";

function formatTime(sec) {
  if (sec == null || Number.isNaN(sec)) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Share() {
  const { token } = useParams();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const queueRef = useRef([]);

  const handleEnded = useCallback(() => {
    const list = queueRef.current;
    if (list.length <= 1) return;
    setQueueIndex((i) => {
      if (i >= list.length - 1) return i;
      return i + 1;
    });
  }, []);

  const player = usePublicSharePlayer({
    shareToken: token ?? "",
    onEnded: handleEnded,
  });

  const {
    setWaveformContainer,
    currentTrack,
    isPlaying,
    isReady,
    isLoading,
    currentTime,
    duration,
    volume,
    muted,
    loadError,
    bufferPct,
    loadTrack,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
  } = player;

  useEffect(() => {
    setQueueIndex(0);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setError(null);
    setPayload(null);
    setStatus(null);
    (async () => {
      try {
        const data = await getPublicShare(token);
        if (cancelled) return;
        setPayload(data);
      } catch (e) {
        if (cancelled) return;
        setStatus(e.status ?? null);
        setError(e.message || "Could not load this share.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const queue = useMemo(() => {
    if (!payload) return [];
    if (payload.share?.type === "project" && payload.project?.tracks) {
      return payload.project.tracks;
    }
    if (payload.track) return [payload.track];
    return [];
  }, [payload]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    if (!token || !queue.length) return;
    const t = queue[queueIndex];
    if (!t) return;
    void loadTrack(t, { autoplay: queueIndex === 0 });
  }, [token, queue, queueIndex, loadTrack]);

  const total = duration || 0;
  const pct = total > 0 ? Math.min(1000, Math.round((1000 * currentTime) / total)) : 0;

  const onSeekInput = useCallback(
    (e) => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v) || !total) return;
      seek((v / 1000) * total);
    },
    [seek, total],
  );

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[oklch(0.14_0.04_260)] px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
          Session Cloud
        </p>
        <h1 className="mt-4 text-xl font-semibold text-fg">
          {status === 410 ? "Link expired" : "Unavailable"}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted">{error}</p>
        <p className="mt-10 text-xs text-muted/70">Powered by Session Cloud</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[oklch(0.14_0.04_260)] text-muted">
        Loading…
      </div>
    );
  }

  const isProject = payload.share?.type === "project";
  const title = isProject
    ? payload.project?.name ?? "Project"
    : trackDisplayName(payload.track);
  const subtitle = isProject
    ? `${queue.length} track${queue.length === 1 ? "" : "s"}`
    : payload.track?.originalName && payload.track?.title
      ? payload.track.originalName
      : null;

  return (
    <div className="min-h-dvh bg-[oklch(0.14_0.04_260)] text-fg">
      <div className="mx-auto max-w-lg px-4 py-10 pb-16">
        <header className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400/90">
            Session Cloud
          </p>
          <h1 className="mt-4 text-xl font-bold leading-snug tracking-tight text-fg sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          ) : null}
        </header>

        <div
          ref={setWaveformContainer}
          className="mt-8 min-h-[80px] w-full rounded-xl border border-white/5 bg-black/20"
        />

        <div className="mt-4 space-y-2">
          <input
            type="range"
            min={0}
            max={1000}
            value={pct}
            onChange={onSeekInput}
            disabled={!isReady || !total}
            className="w-full accent-cyan-500 disabled:opacity-40"
            aria-label="Seek"
          />
          <div className="flex justify-between text-xs text-muted">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(total)}</span>
          </div>
        </div>

        {loadError ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
            {loadError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {isProject && queue.length > 1 ? (
            <button
              type="button"
              onClick={() =>
                setQueueIndex((i) => (i > 0 ? i - 1 : i))
              }
              disabled={queueIndex <= 0 || isLoading}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-fg transition hover:border-cyan-500/40 disabled:opacity-40"
            >
              Previous
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void togglePlay()}
            disabled={!isReady && !isLoading}
            className="rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-[oklch(0.15_0.04_260)] shadow-lg shadow-cyan-900/40 transition hover:brightness-110 disabled:opacity-40"
          >
            {isLoading ? "Loading…" : isPlaying ? "Pause" : "Play"}
          </button>
          {isProject && queue.length > 1 ? (
            <button
              type="button"
              onClick={() =>
                setQueueIndex((i) =>
                  i < queue.length - 1 ? i + 1 : i,
                )
              }
              disabled={queueIndex >= queue.length - 1 || isLoading}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-fg transition hover:border-cyan-500/40 disabled:opacity-40"
            >
              Next
            </button>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted">
          <span>🔊</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((muted ? 0 : volume) * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setVolume(v);
            }}
            className="w-32 accent-cyan-500"
            aria-label="Volume"
          />
          <button
            type="button"
            onClick={() => toggleMute()}
            className="text-xs text-cyan-300/90 underline-offset-2 hover:underline"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>

        {currentTrack ? (
          <p className="mt-6 text-center text-xs text-muted">
            {String(currentTrack.format || "").toUpperCase()}
            {" · "}
            {formatFileSize(currentTrack.filesize)}
            {currentTrack.bitrate != null
              ? ` · ${currentTrack.bitrate} kbps`
              : ""}
            {isLoading ? ` · Buffer ${bufferPct}%` : null}
          </p>
        ) : null}

        {isProject && queue.length > 0 ? (
          <ol className="mt-8 divide-y divide-white/10 rounded-xl border border-white/10 bg-black/15">
            {queue.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setQueueIndex(i)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-white/5 ${
                    queueIndex === i ? "bg-cyan-500/15 text-cyan-100" : "text-fg"
                  }`}
                >
                  <span className="truncate">
                    <span className="text-muted">{i + 1}. </span>
                    {trackDisplayName(t)}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {formatTime(t.duration)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        <footer className="mt-12 space-y-1 text-center text-xs text-muted">
          <p>
            Shared by{" "}
            <span className="font-medium text-cyan-300/90">
              {payload.owner?.username ?? "artist"}
            </span>
          </p>
          {payload.share?.viewCount != null ? (
            <p className="text-muted/80">
              {payload.share.viewCount} view
              {payload.share.viewCount === 1 ? "" : "s"}
            </p>
          ) : null}
          <p className="pt-4 text-[10px] uppercase tracking-widest text-muted/60">
            Powered by Session Cloud
          </p>
        </footer>
      </div>
    </div>
  );
}

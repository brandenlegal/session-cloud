import { useCallback, useEffect } from "react";
import { usePlayerCommands } from "../context/PlayerContext.jsx";
import { usePlayerMeta } from "../context/PlayerContext.jsx";
import { usePlayerTransport } from "../context/PlayerContext.jsx";
import { Waveform } from "./Waveform.jsx";
import { trackDisplayName } from "../lib/trackDisplayName.js";

function formatTime(sec) {
  if (sec == null || Number.isNaN(sec)) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isEditableTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

export function AudioPlayer() {
  const { playNext, playPrevious } = usePlayerCommands();
  const { currentTrack, isPlaying, isLoading, loadError, duration: metaDuration } =
    usePlayerMeta();
  const transport = usePlayerTransport();
  const {
    currentTime,
    duration,
    volume,
    muted,
    bufferPct,
    setWaveformContainer,
    seek,
    skip,
    togglePlay,
    setVolume,
    toggleMute,
    clearError,
  } = transport;

  const visible = Boolean(currentTrack || loadError);
  const total = duration || metaDuration || 0;

  const onSeekInput = useCallback(
    (e) => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v) || !total) return;
      seek((v / 1000) * total);
    },
    [seek, total],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (!visible) return;
      if (isEditableTarget(document.activeElement)) return;

      if (e.code === "Space") {
        e.preventDefault();
        void togglePlay();
        return;
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        skip(-5);
        return;
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        skip(5);
        return;
      }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        setVolume(volume + 0.1);
        return;
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        setVolume(volume - 0.1);
        return;
      }
      if (e.code === "KeyM") {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, setVolume, skip, toggleMute, togglePlay, volume]);

  const pct = total > 0 ? Math.min(1000, Math.round((1000 * currentTime) / total)) : 0;

  return (
    <div
      className={
        visible
          ? "fixed inset-x-0 bottom-0 z-50 border-t border-cyan-500/20 bg-[oklch(0.16_0.05_260/0.92)] px-3 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md md:px-6"
          : "pointer-events-none fixed -left-[9999px] top-0 z-0 h-[88px] w-[min(100vw,720px)] opacity-0"
      }
      role="region"
      aria-label="Audio player"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        {visible ? (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="truncate text-sm font-medium text-fg">
              <span className="text-muted">Now playing</span>{" "}
              <span className="text-cyan-300">
                {trackDisplayName(currentTrack) || "—"}
              </span>
            </p>
            <div className="flex items-center gap-2 text-xs text-muted">
              {isLoading ? (
                <span>
                  Loading… {bufferPct != null ? `${bufferPct}%` : ""}
                </span>
              ) : null}
              {loadError ? (
                <span className="text-red-300">
                  {loadError}
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() => clearError()}
                  >
                    Dismiss
                  </button>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <Waveform setContainer={setWaveformContainer} />

        {visible ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <label className="sr-only" htmlFor="session-seek">
                Seek
              </label>
              <input
                id="session-seek"
                type="range"
                min={0}
                max={1000}
                value={pct}
                onChange={onSeekInput}
                className="h-2 w-full flex-1 cursor-pointer appearance-none rounded-full bg-[oklch(0.22_0.04_250)] accent-cyan-400 sm:order-2"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={currentTime}
              />

              <div className="flex shrink-0 items-center justify-between gap-3 sm:order-1 sm:flex-col sm:items-start sm:gap-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous track"
                    onClick={() => void playPrevious()}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-lg text-fg transition hover:border-cyan-500/50 hover:text-cyan-300 active:scale-[0.97] md:h-12 md:w-12 md:active:scale-100"
                  >
                    ⏮
                  </button>
                  <button
                    type="button"
                    aria-label={isPlaying ? "Pause" : "Play"}
                    onClick={() => void togglePlay()}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-cyan-500 to-cyan-600 text-xl text-white shadow-lg shadow-cyan-900/40 transition hover:brightness-110 active:scale-[0.98] md:h-16 md:w-16 md:active:scale-100"
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <button
                    type="button"
                    aria-label="Next track"
                    onClick={() => void playNext()}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-lg text-fg transition hover:border-cyan-500/50 hover:text-cyan-300 active:scale-[0.97] md:h-12 md:w-12 md:active:scale-100"
                  >
                    ⏭
                  </button>
                </div>
                <p className="font-mono text-xs text-muted tabular-nums sm:hidden">
                  {formatTime(currentTime)} / {formatTime(total)}
                </p>
              </div>

              <p className="hidden shrink-0 font-mono text-xs text-muted tabular-nums sm:order-3 sm:block">
                {formatTime(currentTime)} / {formatTime(total)}
              </p>

              <div className="flex items-center gap-2 sm:order-4 sm:ml-auto">
                <button
                  type="button"
                  aria-label={muted ? "Unmute" : "Mute"}
                  onClick={() => toggleMute()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-sm transition hover:border-cyan-500/40 active:scale-[0.97] md:active:scale-100"
                >
                  {muted ? "🔇" : "🔊"}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  className="h-2 w-24 cursor-pointer appearance-none rounded-full bg-[oklch(0.22_0.04_250)] accent-cyan-400 md:w-32"
                  aria-label="Volume"
                />
                <span className="w-9 text-right text-xs text-muted tabular-nums">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { fetchPublicShareStreamBlob } from "../lib/api.js";

function formatWaveErr(err) {
  const directStatus =
    err != null &&
    typeof err === "object" &&
    Number.isFinite(err.status) &&
    err.status >= 400
      ? err.status
      : null;
  if (directStatus === 404) {
    return { status: 404, message: err.message || "Not found" };
  }
  if (directStatus === 410) {
    return { status: 410, message: err.message || "This link has expired" };
  }
  if (directStatus === 400) {
    return { status: 400, message: err.message || "Bad request" };
  }
  const msg = err?.message ?? String(err);
  const m = msg.match(/\b(\d{3})\s*\([^)]*\)\s*$/);
  const status = m ? Number(m[1]) : null;
  if (status === 410) return { status, message: "This link has expired" };
  if (status === 404) return { status, message: "Track or file not found" };
  return { status, message: msg || "Playback failed" };
}

/**
 * WaveSurfer playback for a public share token (no login).
 * @param {{ shareToken: string, onEnded?: () => void }} opts
 */
export function usePublicSharePlayer(opts) {
  const { shareToken, onEnded } = opts;
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const wsRef = useRef(null);
  const volumeRef = useRef(0.9);
  const mutedRef = useRef(false);
  const currentTrackIdRef = useRef(null);
  const pendingLoadRef = useRef(null);

  const [container, setContainer] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => volumeRef.current);
  const [muted, setMuted] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [bufferPct, setBufferPct] = useState(0);

  const runLoad = useCallback(
    async (track, loadOpts = {}) => {
      const ws = wsRef.current;
      if (!ws || !track?.id || !shareToken) return;

      const { autoplay = true } = loadOpts;
      setLoadError(null);
      setIsLoading(true);
      setIsReady(false);
      setCurrentTime(0);
      setDuration(track.duration != null ? Number(track.duration) : 0);
      setBufferPct(0);
      setCurrentTrack(track);
      currentTrackIdRef.current = track.id;

      try {
        const blob = await fetchPublicShareStreamBlob(shareToken, track.id, {
          onProgress(ev) {
            if (ev.total) {
              setBufferPct(Math.round((100 * ev.loaded) / ev.total));
            }
          },
        });

        const mimeFromFormat = {
          wav: "audio/wav",
          mp3: "audio/mpeg",
          flac: "audio/flac",
          m4a: "audio/mp4",
          aac: "audio/aac",
        };
        const fmt = String(track.format || "").toLowerCase();
        const mime = mimeFromFormat[fmt] || "audio/wav";
        const typedBlob =
          !blob.type || blob.type === "application/octet-stream"
            ? new Blob([blob], { type: mime })
            : blob;

        await ws.loadBlob(typedBlob);
        const d = ws.getDuration();
        if (d) setDuration(d);

        const vol = mutedRef.current ? 0 : volumeRef.current;
        ws.setVolume(vol);

        if (autoplay) {
          await ws.play();
        }
      } catch (e) {
        setIsLoading(false);
        const info = formatWaveErr(e);
        setLoadError(info.message);
      }
    },
    [shareToken],
  );

  useEffect(() => {
    if (!container) return;

    const ws = WaveSurfer.create({
      container,
      height: 80,
      waveColor: "oklch(0.32 0.05 250)",
      progressColor: "oklch(0.72 0.14 195)",
      cursorColor: "oklch(0.92 0.1 190)",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      dragToSeek: { debounceTime: 80 },
      interact: true,
      normalize: true,
      fillParent: true,
    });

    wsRef.current = ws;

    ws.setVolume(mutedRef.current ? 0 : volumeRef.current);

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("timeupdate", (t) => setCurrentTime(t));
    ws.on("loading", (pct) => setBufferPct(pct));
    ws.on("finish", () => {
      setIsPlaying(false);
      onEndedRef.current?.();
    });

    ws.on("ready", (d) => {
      setIsReady(true);
      setIsLoading(false);
      setDuration(d);
      setBufferPct(100);
    });

    ws.on("error", (err) => {
      setIsLoading(false);
      const info = formatWaveErr(err);
      setLoadError(info.message);
    });

    const pending = pendingLoadRef.current;
    if (pending) {
      pendingLoadRef.current = null;
      void runLoad(pending.track, pending.opts);
    }

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [container, runLoad]);

  const setWaveformContainer = useCallback((el) => {
    setContainer((prev) => (prev === el ? prev : el));
  }, []);

  const loadTrack = useCallback(
    async (track, loadOpts = {}) => {
      if (!wsRef.current) {
        pendingLoadRef.current = { track, opts: loadOpts };
        setCurrentTrack(track);
        currentTrackIdRef.current = track?.id ?? null;
        setLoadError(null);
        setIsLoading(true);
        setIsReady(false);
        setDuration(track?.duration != null ? Number(track.duration) : 0);
        return;
      }
      await runLoad(track, loadOpts);
    },
    [runLoad],
  );

  const togglePlay = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      await ws.playPause();
    } catch {
      setLoadError("Playback was blocked or failed");
    }
  }, []);

  const seek = useCallback((timeSeconds) => {
    const ws = wsRef.current;
    if (!ws) return;
    const d = ws.getDuration() || 0;
    const t = d ? Math.max(0, Math.min(timeSeconds, d)) : Math.max(0, timeSeconds);
    ws.setTime(t);
    setCurrentTime(t);
  }, []);

  const skip = useCallback(
    (delta) => {
      const ws = wsRef.current;
      const base = ws?.getCurrentTime() ?? 0;
      seek(base + delta);
    },
    [seek],
  );

  const setVolume = useCallback((level) => {
    const v = Math.min(1, Math.max(0, level));
    volumeRef.current = v;
    setVolumeState(v);
    const ws = wsRef.current;
    if (ws) ws.setVolume(mutedRef.current ? 0 : v);
  }, []);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    const ws = wsRef.current;
    if (ws) ws.setVolume(mutedRef.current ? 0 : volumeRef.current);
  }, []);

  return {
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
    skip,
    setVolume,
    toggleMute,
  };
}

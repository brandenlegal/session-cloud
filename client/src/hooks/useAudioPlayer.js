import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import WaveSurfer from "wavesurfer.js";
import { fetchTrackStreamBlob } from "../lib/api.js";

const VOLUME_KEY = "session_cloud_volume";
const POS_PREFIX = "session_cloud_pos_";

function readSavedVolume() {
  const raw = localStorage.getItem(VOLUME_KEY);
  const n = raw == null ? 0.85 : Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.85;
}

function saveVolume(v) {
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
  } catch {
    /* ignore */
  }
}

function readSavedPosition(trackId) {
  try {
    const raw = localStorage.getItem(POS_PREFIX + trackId);
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function savePosition(trackId, seconds) {
  try {
    localStorage.setItem(POS_PREFIX + trackId, String(Math.floor(seconds)));
  } catch {
    /* ignore */
  }
}

function formatWaveErr(err) {
  const directStatus =
    err != null &&
    typeof err === "object" &&
    Number.isFinite(err.status) &&
    err.status >= 400
      ? err.status
      : null;
  if (directStatus === 401) {
    return { status: 401, message: "Session expired or unauthorized" };
  }
  if (directStatus === 403) {
    return { status: 403, message: "You do not have access to this track" };
  }
  if (directStatus === 404) {
    return { status: 404, message: "Track or file not found" };
  }
  if (directStatus === 500) {
    return { status: 500, message: "Server error loading audio file" };
  }
  if (directStatus === 503) {
    return { status: 503, message: "Service unavailable (API or database)" };
  }

  if (axios.isAxiosError?.(err)) {
    const st = err.response?.status;
    if (st === 401) return { status: 401, message: "Session expired or unauthorized" };
    if (st === 403) return { status: 403, message: "You do not have access to this track" };
    if (st === 404) return { status: 404, message: "Track or file not found" };
    if (st === 500) return { status: 500, message: "Server error loading audio file" };
    if (st === 503) return { status: 503, message: "Service unavailable (API or database)" };
    const msg =
      (typeof err.response?.data === "string" && err.response.data) ||
      err.message ||
      "Stream request failed";
    return { status: st ?? null, message: String(msg).slice(0, 200) };
  }

  const msg = err?.message ?? String(err);
  // WaveSurfer fetcher: `Failed to fetch ${url}: ${status} (${statusText})`
  const m = msg.match(/\b(\d{3})\s*\([^)]*\)\s*$/);
  const status = m ? Number(m[1]) : null;
  if (status === 401) return { status, message: "Session expired or unauthorized" };
  if (status === 404) return { status, message: "Track or file not found" };
  if (status === 503) return { status, message: "Service unavailable (API or database)" };
  if (msg.includes("Failed to fetch") || err?.name === "TypeError") {
    return {
      status: null,
      message:
        "Network error (check API is running, dev URL uses /api proxy, and browser console)",
    };
  }
  return { status, message: msg || "Playback failed" };
}

/**
 * @param {{ onEnded?: () => void, onStreamError?: (info: { status: number | null, message: string }) => void }} opts
 */
export function useAudioPlayer(opts = {}) {
  const { onEnded, onStreamError } = opts;
  const onEndedRef = useRef(onEnded);
  const onStreamErrorRef = useRef(onStreamError);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);
  useEffect(() => {
    onStreamErrorRef.current = onStreamError;
  }, [onStreamError]);

  const wsRef = useRef(null);
  const volumeRef = useRef(readSavedVolume());
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

  const posSaveTimer = useRef(null);

  const runLoad = useCallback(async (track, { autoplay = true } = {}) => {
    const ws = wsRef.current;
    if (!ws || !track?.id) return;

    setLoadError(null);
    setIsLoading(true);
    setIsReady(false);
    setCurrentTime(0);
    setDuration(track.duration != null ? Number(track.duration) : 0);
    setBufferPct(0);
    setCurrentTrack(track);
    currentTrackIdRef.current = track.id;

    if (import.meta.env.DEV) {
      console.info("[audio] load stream (fetch + access_token → blob → WaveSurfer)", {
        trackId: track.id,
      });
    }

    try {
      const blob = await fetchTrackStreamBlob(track.id, {
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

      const saved = readSavedPosition(track.id);
      if (saved != null && saved > 0.5 && d && saved < d - 0.5) {
        ws.setTime(saved);
      }

      if (autoplay) {
        await ws.play();
      }
    } catch (e) {
      setIsLoading(false);
      console.error("[audio] load failed:", e);
      const info = formatWaveErr(e);
      setLoadError(info.message);
      onStreamErrorRef.current?.(info);
    }
  }, []);

  useEffect(() => {
    if (!container) return;

    const ws = WaveSurfer.create({
      container,
      height: 80,
      waveColor: "oklch(0.28 0.06 250)",
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

    const v0 = volumeRef.current;
    ws.setVolume(mutedRef.current ? 0 : v0);

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("timeupdate", (t) => setCurrentTime(t));
    ws.on("loading", (pct) => setBufferPct(pct));
    ws.on("finish", () => {
      setIsPlaying(false);
      const id = currentTrackIdRef.current;
      if (id) savePosition(id, 0);
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
      console.error("[audio] WaveSurfer error:", err);
      const info = formatWaveErr(err);
      setLoadError(info.message);
      onStreamErrorRef.current?.(info);
    });

    const pending = pendingLoadRef.current;
    if (pending) {
      pendingLoadRef.current = null;
      void runLoad(pending.track, pending.opts);
    }

    return () => {
      if (posSaveTimer.current) clearInterval(posSaveTimer.current);
      posSaveTimer.current = null;
      ws.destroy();
      wsRef.current = null;
    };
  }, [container, runLoad]);

  useEffect(() => {
    const id = currentTrack?.id;
    if (!id) return;
    if (posSaveTimer.current) clearInterval(posSaveTimer.current);
    posSaveTimer.current = setInterval(() => {
      const w = wsRef.current;
      if (!w || !currentTrackIdRef.current) return;
      try {
        savePosition(currentTrackIdRef.current, w.getCurrentTime());
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => {
      if (posSaveTimer.current) clearInterval(posSaveTimer.current);
      posSaveTimer.current = null;
    };
  }, [currentTrack?.id]);

  const setWaveformContainer = useCallback((el) => {
    setContainer((prev) => (prev === el ? prev : el));
  }, []);

  const loadTrack = useCallback(
    async (track, opts = {}) => {
      if (!wsRef.current) {
        pendingLoadRef.current = { track, opts };
        setCurrentTrack(track);
        currentTrackIdRef.current = track?.id ?? null;
        setLoadError(null);
        setIsLoading(true);
        setIsReady(false);
        setDuration(track?.duration != null ? Number(track.duration) : 0);
        return;
      }
      await runLoad(track, opts);
    },
    [runLoad],
  );

  const play = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      await ws.play();
    } catch {
      setLoadError("Playback was blocked or failed");
    }
  }, []);

  const pause = useCallback(() => {
    wsRef.current?.pause();
  }, []);

  const togglePlay = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      await ws.playPause();
    } catch {
      setLoadError("Playback was blocked or failed");
    }
  }, []);

  const stop = useCallback(() => {
    const ws = wsRef.current;
    const id = currentTrackIdRef.current;
    if (id && ws) {
      try {
        savePosition(id, ws.getCurrentTime());
      } catch {
        /* ignore */
      }
    }
    ws?.pause();
    ws?.stop();
    currentTrackIdRef.current = null;
    pendingLoadRef.current = null;
    setCurrentTrack(null);
    setIsPlaying(false);
    setIsReady(false);
    setLoadError(null);
    setCurrentTime(0);
    setDuration(0);
    try {
      ws?.empty();
    } catch {
      /* ignore */
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
    saveVolume(v);
    const ws = wsRef.current;
    if (ws) ws.setVolume(mutedRef.current ? 0 : v);
  }, []);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    const ws = wsRef.current;
    if (ws) ws.setVolume(mutedRef.current ? 0 : volumeRef.current);
  }, []);

  const setMutedValue = useCallback((m) => {
    mutedRef.current = m;
    setMuted(m);
    const ws = wsRef.current;
    if (ws) ws.setVolume(m ? 0 : volumeRef.current);
  }, []);

  const clearError = useCallback(() => {
    setLoadError(null);
    setCurrentTrack(null);
    currentTrackIdRef.current = null;
    try {
      wsRef.current?.empty();
    } catch {
      /* ignore */
    }
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
    play,
    pause,
    togglePlay,
    stop,
    seek,
    skip,
    setVolume,
    toggleMute,
    setMutedValue,
    clearError,
  };
}

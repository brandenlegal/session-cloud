import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAudioPlayer } from "../hooks/useAudioPlayer.js";
import { removeAuthToken } from "../lib/api.js";
import { removeToken } from "../lib/auth.js";

const NOW_KEY = "session_cloud_now_playing";

const PlayerCommandsContext = createContext(null);
const PlayerMetaContext = createContext(null);
const PlayerTransportContext = createContext(null);

function saveNowPlaying(track) {
  try {
    if (track) {
      localStorage.setItem(
        NOW_KEY,
        JSON.stringify({
          id: track.id,
          originalName: track.originalName,
        }),
      );
    } else {
      localStorage.removeItem(NOW_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function PlayerProvider({ children }) {
  const navigate = useNavigate();
  const queueRef = useRef([]);
  const indexRef = useRef(0);

  const handleEnded = useCallback(() => {
    const q = queueRef.current;
    let i = indexRef.current;
    if (i < q.length - 1) {
      i += 1;
      indexRef.current = i;
      const next = q[i];
      saveNowPlaying(next);
      void loadRef.current(next, { autoplay: true });
    }
  }, []);

  const handleStreamError = useCallback(
    (info) => {
      if (info.status === 401) {
        toast.error("Session expired. Please sign in again.");
        removeToken();
        removeAuthToken();
        navigate("/login", { replace: true });
      }
    },
    [navigate],
  );

  const audio = useAudioPlayer({
    onEnded: handleEnded,
    onStreamError: handleStreamError,
  });

  const loadRef = useRef(audio.loadTrack);
  loadRef.current = audio.loadTrack;

  const playTrack = useCallback(async (track, allTracks, opts = {}) => {
    const list =
      Array.isArray(allTracks) && allTracks.length ? allTracks : [track];
    const idx = list.findIndex((t) => t.id === track.id);
    queueRef.current = list;
    indexRef.current = idx >= 0 ? idx : 0;
    saveNowPlaying(track);
    await audio.loadTrack(track, { autoplay: opts.autoplay !== false });
  }, [audio.loadTrack]);

  const playNext = useCallback(async () => {
    const q = queueRef.current;
    let i = indexRef.current;
    if (i >= q.length - 1) return;
    i += 1;
    indexRef.current = i;
    const t = q[i];
    saveNowPlaying(t);
    await audio.loadTrack(t, { autoplay: true });
  }, [audio.loadTrack]);

  const playPrevious = useCallback(async () => {
    const q = queueRef.current;
    let i = indexRef.current;
    if (i <= 0) return;
    i -= 1;
    indexRef.current = i;
    const t = q[i];
    saveNowPlaying(t);
    await audio.loadTrack(t, { autoplay: true });
  }, [audio.loadTrack]);

  const stop = useCallback(() => {
    saveNowPlaying(null);
    audio.stop();
  }, [audio.stop]);

  const syncQueue = useCallback((tracks) => {
    if (!Array.isArray(tracks)) return;
    queueRef.current = tracks;
    const curId = audio.currentTrack?.id;
    if (curId) {
      const ni = tracks.findIndex((t) => t.id === curId);
      if (ni >= 0) indexRef.current = ni;
    }
  }, [audio.currentTrack?.id]);

  const clearPlaybackError = useCallback(() => {
    saveNowPlaying(null);
    audio.clearError();
  }, [audio.clearError]);

  const commands = useMemo(
    () => ({
      playTrack,
      playNext,
      playPrevious,
      stop,
      syncQueue,
    }),
    [playNext, playPrevious, playTrack, stop, syncQueue],
  );

  const meta = useMemo(
    () => ({
      currentTrack: audio.currentTrack,
      isPlaying: audio.isPlaying,
      isReady: audio.isReady,
      isLoading: audio.isLoading,
      loadError: audio.loadError,
      duration: audio.duration,
    }),
    [
      audio.currentTrack,
      audio.duration,
      audio.isLoading,
      audio.isPlaying,
      audio.isReady,
      audio.loadError,
    ],
  );

  const transport = useMemo(
    () => ({
      currentTime: audio.currentTime,
      duration: audio.duration,
      volume: audio.volume,
      muted: audio.muted,
      bufferPct: audio.bufferPct,
      loadError: audio.loadError,
      setWaveformContainer: audio.setWaveformContainer,
      seek: audio.seek,
      skip: audio.skip,
      togglePlay: audio.togglePlay,
      play: audio.play,
      pause: audio.pause,
      setVolume: audio.setVolume,
      toggleMute: audio.toggleMute,
      setMutedValue: audio.setMutedValue,
      clearError: clearPlaybackError,
      isPlaying: audio.isPlaying,
      isLoading: audio.isLoading,
      isReady: audio.isReady,
      currentTrack: audio.currentTrack,
    }),
    [
      audio.bufferPct,
      clearPlaybackError,
      audio.currentTime,
      audio.currentTrack,
      audio.duration,
      audio.isLoading,
      audio.isPlaying,
      audio.isReady,
      audio.loadError,
      audio.muted,
      audio.pause,
      audio.play,
      audio.seek,
      audio.setMutedValue,
      audio.setVolume,
      audio.setWaveformContainer,
      audio.skip,
      audio.toggleMute,
      audio.togglePlay,
      audio.volume,
    ],
  );

  return (
    <PlayerCommandsContext.Provider value={commands}>
      <PlayerMetaContext.Provider value={meta}>
        <PlayerTransportContext.Provider value={transport}>
          {children}
        </PlayerTransportContext.Provider>
      </PlayerMetaContext.Provider>
    </PlayerCommandsContext.Provider>
  );
}

export function usePlayerCommands() {
  const ctx = useContext(PlayerCommandsContext);
  if (!ctx) throw new Error("usePlayerCommands requires PlayerProvider");
  return ctx;
}

export function usePlayerMeta() {
  const ctx = useContext(PlayerMetaContext);
  if (!ctx) throw new Error("usePlayerMeta requires PlayerProvider");
  return ctx;
}

export function usePlayerTransport() {
  const ctx = useContext(PlayerTransportContext);
  if (!ctx) throw new Error("usePlayerTransport requires PlayerProvider");
  return ctx;
}

/** Full player surface (re-renders on transport ticks — prefer split hooks). */
export function usePlayer() {
  const commands = usePlayerCommands();
  const meta = usePlayerMeta();
  const transport = usePlayerTransport();
  return { ...commands, ...meta, ...transport };
}

export function usePlayerOptional() {
  const commands = useContext(PlayerCommandsContext);
  const meta = useContext(PlayerMetaContext);
  const transport = useContext(PlayerTransportContext);
  if (!commands) return null;
  return { ...commands, ...meta, ...transport };
}

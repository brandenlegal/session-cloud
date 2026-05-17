import axios from "axios";
import { getToken } from "./auth.js";

const baseURL = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");

const api = axios.create({
  baseURL: baseURL || undefined,
  timeout: 60_000,
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function removeAuthToken() {
  delete api.defaults.headers.common.Authorization;
}

const existing = getToken();
if (existing) {
  setAuthToken(existing);
}

/**
 * @param {File} file
 * @param {{ onProgress?: (pct: number) => void, signal?: AbortSignal }} [opts]
 */
export async function uploadTrack(file, opts = {}) {
  const { onProgress, signal } = opts;
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/api/tracks/upload", form, {
    timeout: 120_000,
    signal,
    onUploadProgress(ev) {
      if (onProgress && ev.total) {
        onProgress(Math.round((100 * ev.loaded) / ev.total));
      }
    },
  });
  return data.track;
}

/**
 * @param {{ sort?: 'date' | 'name', order?: 'asc' | 'desc', projectId?: string }} [params]
 */
export async function getTracks(params = {}) {
  const sp = new URLSearchParams();
  if (params.sort) sp.set("sort", params.sort);
  if (params.order) sp.set("order", params.order);
  if (params.projectId) sp.set("projectId", params.projectId);
  const q = sp.toString();
  const { data } = await api.get(`/api/tracks${q ? `?${q}` : ""}`);
  return data.tracks;
}

/**
 * @param {{ sort?: 'name' | 'date', order?: 'asc' | 'desc' }} [params]
 */
export async function getProjects(params = {}) {
  const sp = new URLSearchParams();
  if (params.sort) sp.set("sort", params.sort);
  if (params.order) sp.set("order", params.order);
  const q = sp.toString();
  const { data } = await api.get(`/api/projects${q ? `?${q}` : ""}`);
  return data.projects;
}

export async function getProject(id) {
  const { data } = await api.get(`/api/projects/${encodeURIComponent(id)}`);
  return data.project;
}

export async function createProject(body) {
  const { data } = await api.post("/api/projects", body);
  return data.project;
}

export async function updateProject(id, body) {
  const { data } = await api.patch(
    `/api/projects/${encodeURIComponent(id)}`,
    body,
  );
  return data.project;
}

export async function deleteProject(id) {
  await api.delete(`/api/projects/${encodeURIComponent(id)}`);
}

/**
 * @param {string} trackId
 * @param {Record<string, unknown>} body — title, artist, bpm, key, notes, projectId
 */
export async function updateTrack(trackId, body) {
  const { data } = await api.patch(
    `/api/tracks/${encodeURIComponent(trackId)}`,
    body,
  );
  return data.track;
}

export async function addTracksToProject(projectId, trackIds) {
  const { data } = await api.post(
    `/api/projects/${encodeURIComponent(projectId)}/tracks`,
    { trackIds },
  );
  return data.project;
}

export async function removeTrackFromProject(trackId) {
  return updateTrack(trackId, { projectId: null });
}

/** Base URL for links shown to humans (share page). */
export function getAppOrigin() {
  const u = (import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (u) return u;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}

export function buildSharePageUrl(token) {
  const base = getAppOrigin() || "http://localhost:5173";
  return `${base}/share/${encodeURIComponent(token)}`;
}

/**
 * @param {{ type: 'track' | 'project', id: string, expiresIn?: number | null, expiresAt?: string | null }} body
 */
export async function createShare(body) {
  const { data } = await api.post("/api/shares", body);
  return data.share;
}

export async function getShares() {
  const { data } = await api.get("/api/shares");
  return data.shares;
}

export async function revokeShare(shareId) {
  await api.delete(`/api/shares/${encodeURIComponent(shareId)}`);
}

/**
 * Public share payload (no auth).
 * @param {string} token
 */
export async function getPublicShare(token) {
  const path = `/api/shares/public/${encodeURIComponent(token)}`;
  const origin =
    baseURL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const u = new URL(path, origin.endsWith("/") ? origin.slice(0, -1) : origin);
  const res = await fetch(u.href, {
    method: "GET",
    mode: baseURL ? "cors" : "same-origin",
    credentials: "omit",
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const text = await res.text();
      const j = JSON.parse(text);
      if (j.error) message = j.error;
    } catch {
      /* ignore */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * Stream audio for a public share (no auth). Project shares require `trackId`.
 *
 * @param {string} shareToken
 * @param {string} trackId
 * @param {{ signal?: AbortSignal, onProgress?: (ev: { loaded: number, total?: number }) => void }} [opts]
 */
export async function fetchPublicShareStreamBlob(shareToken, trackId, opts = {}) {
  const { signal, onProgress } = opts;
  const sp = new URLSearchParams();
  if (trackId) sp.set("trackId", trackId);
  const q = sp.toString();
  const path = `/api/shares/public/${encodeURIComponent(shareToken)}/stream${q ? `?${q}` : ""}`;
  const origin =
    baseURL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const u = new URL(path, origin.endsWith("/") ? origin.slice(0, -1) : origin);

  const res = await fetch(u.href, {
    method: "GET",
    signal,
    mode: baseURL ? "cors" : "same-origin",
    credentials: "omit",
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Failed to fetch stream (${res.status})`;
    try {
      const text = await res.text();
      const j = JSON.parse(text);
      if (j.error) message = j.error;
    } catch {
      /* ignore */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  const total = Number(res.headers.get("content-length")) || 0;
  const type = res.headers.get("content-type") || "application/octet-stream";

  if (onProgress && res.body && total > 0) {
    const reader = res.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress({ loaded, total });
    }
    return new Blob(chunks, { type });
  }

  return await res.blob();
}

export async function deleteTrack(trackId) {
  await api.delete(`/api/tracks/${trackId}`);
}

/**
 * Download track audio as a Blob.
 * Uses native `fetch` (not axios) so the default `Authorization` header is never sent.
 * Auth is `?access_token=` (supported by the API) — a simple GET that works through the Vite
 * proxy without cross-origin calls to 127.0.0.1 (which Chrome often blocks as net::ERR_FAILED).
 *
 * @param {string} trackId
 * @param {{ signal?: AbortSignal, onProgress?: (ev: { loaded: number, total?: number }) => void }} [opts]
 */
export async function fetchTrackStreamBlob(trackId, opts = {}) {
  const { signal, onProgress } = opts;
  const t = getToken();
  if (!t) {
    const e = new Error("Missing auth token");
    e.status = 401;
    throw e;
  }

  const path = `/api/tracks/${encodeURIComponent(trackId)}/stream`;
  const origin =
    baseURL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const u = new URL(path, origin.endsWith("/") ? origin.slice(0, -1) : origin);
  u.searchParams.set("access_token", t);

  const res = await fetch(u.href, {
    method: "GET",
    signal,
    mode: baseURL ? "cors" : "same-origin",
    credentials: "omit",
    cache: "no-store",
  });

  if (!res.ok) {
    const err = new Error(
      `Failed to fetch ${u.pathname}: ${res.status} (${res.statusText})`,
    );
    err.status = res.status;
    throw err;
  }

  const total = Number(res.headers.get("content-length")) || 0;
  const type = res.headers.get("content-type") || "application/octet-stream";

  if (onProgress && res.body && total > 0) {
    const reader = res.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress({ loaded, total });
    }
    return new Blob(chunks, { type });
  }

  return await res.blob();
}

export default api;

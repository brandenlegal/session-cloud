import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { resolveUploadRoot } from "../middleware/upload.js";

const MIME_TYPES = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
};

function contentTypeFromTrack(track, absPath) {
  const fromFormat = String(track?.format || "").toLowerCase();
  if (fromFormat && MIME_TYPES[fromFormat]) {
    return MIME_TYPES[fromFormat];
  }
  const ext = path.extname(absPath).replace(".", "").toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;
  const range = rangeHeader.slice(6).trim();
  const dash = range.indexOf("-");
  if (dash < 0) return null;

  const startStr = range.slice(0, dash);
  const endStr = range.slice(dash + 1);

  if (startStr === "" && endStr !== "") {
    const suffix = parseInt(endStr, 10);
    if (Number.isNaN(suffix) || suffix <= 0) return null;
    const start = Math.max(0, size - suffix);
    return { start, end: size - 1 };
  }

  const start = startStr ? parseInt(startStr, 10) : 0;
  let end = endStr ? parseInt(endStr, 10) : size - 1;
  if (Number.isNaN(start) || start < 0 || start >= size) return null;
  if (Number.isNaN(end)) end = size - 1;
  end = Math.min(end, size - 1);
  if (end < start) return null;
  return { start, end };
}

/**
 * Stream a track file to the HTTP response (Range-capable).
 * @param {import("@prisma/client").Track} track
 */
export async function sendTrackStream(req, res, next, track) {
  try {
    const root = resolveUploadRoot();
    const absPath = path.join(root, ...track.filepath.split("/"));

    if (!fs.existsSync(absPath)) {
      const err = new Error("Audio file missing on disk");
      err.status = 500;
      throw err;
    }

    let stat;
    try {
      stat = await fsp.stat(absPath);
    } catch (e) {
      console.error("[sendTrackStream] stat failed", absPath, e.message);
      const err = new Error("Audio file missing on disk");
      err.status = 500;
      throw err;
    }

    const size = stat.size;
    const contentType = contentTypeFromTrack(track, absPath);
    const rangeHeader = req.headers.range;

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=0");

    if (rangeHeader) {
      const parsed = parseRange(rangeHeader, size);
      if (!parsed) {
        res.status(416);
        res.setHeader("Content-Range", `bytes */${size}`);
        return res.end();
      }
      const { start, end } = parsed;
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", String(chunkSize));
      res.setHeader("Content-Type", contentType);

      const stream = fs.createReadStream(absPath, { start, end });
      stream.on("error", (e) => {
        console.error("[sendTrackStream]", e.message);
        if (!res.headersSent) next(e);
        else res.destroy();
      });
      return stream.pipe(res);
    }

    res.status(200);
    res.setHeader("Content-Length", String(size));
    res.setHeader("Content-Type", contentType);

    const stream = fs.createReadStream(absPath);
    stream.on("error", (e) => {
      console.error("[sendTrackStream]", e.message);
      if (!res.headersSent) next(e);
      else res.destroy();
    });
    return stream.pipe(res);
  } catch (e) {
    next(e);
  }
}

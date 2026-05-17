import fs from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import { prisma } from "../lib/prisma.js";
import { resolveUploadRoot } from "../middleware/upload.js";

function formatFromFilename(name) {
  return path.extname(name).replace(".", "").toLowerCase() || "unknown";
}

function safeOriginalName(name) {
  return path.basename(String(name).replace(/\0/g, "")).slice(0, 512);
}

export async function uploadTrack(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error('No file uploaded (use form field "file")');
      err.status = 400;
      throw err;
    }

    const absolutePath = req.file.path;
    let duration = null;
    let bitrate = null;

    try {
      const meta = await parseFile(absolutePath);
      duration =
        meta.format.duration != null ? Number(meta.format.duration) : null;
      bitrate =
        meta.format.bitrate != null
          ? Math.round(meta.format.bitrate / 1000)
          : null;
    } catch (metaErr) {
      console.warn("[upload] music-metadata:", metaErr.message);
    }

    const root = resolveUploadRoot();
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");

    const track = await prisma.track.create({
      data: {
        userId: req.user.id,
        filename: req.file.filename,
        originalName: safeOriginalName(req.file.originalname),
        filepath: relativePath,
        filesize: req.file.size,
        format: formatFromFilename(req.file.originalname),
        duration,
        bitrate,
      },
    });

    res.status(201).json({ track });
  } catch (e) {
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch {
        /* ignore */
      }
    }
    next(e);
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listTracks(req, res, next) {
  try {
    const sort = req.query.sort === "name" ? "name" : "date";
    const order = req.query.order === "asc" ? "asc" : "desc";
    const orderBy =
      sort === "name"
        ? { originalName: order }
        : { uploadedAt: order };

    const where = { userId: req.user.id };
    const pid = typeof req.query.projectId === "string" ? req.query.projectId.trim() : "";
    if (pid === "unassigned" || pid === "none") {
      where.projectId = null;
    } else if (UUID_RE.test(pid)) {
      where.projectId = pid;
    }

    const tracks = await prisma.track.findMany({
      where,
      orderBy,
      include: {
        project: { select: { id: true, name: true } },
      },
    });
    res.json({ tracks });
  } catch (e) {
    next(e);
  }
}

export async function updateTrack(req, res, next) {
  try {
    const track = await prisma.track.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!track) {
      const err = new Error("Track not found");
      err.status = 404;
      throw err;
    }

    const data = {};

    if (req.body?.title !== undefined) {
      const v = req.body.title;
      data.title =
        v == null || v === ""
          ? null
          : String(v).trim().slice(0, 512) || null;
    }
    if (req.body?.artist !== undefined) {
      const v = req.body.artist;
      data.artist =
        v == null || v === ""
          ? null
          : String(v).trim().slice(0, 256) || null;
    }
    if (req.body?.bpm !== undefined) {
      const v = req.body.bpm;
      if (v == null || v === "") {
        data.bpm = null;
      } else {
        const n = Number(v);
        if (Number.isNaN(n) || n < 0 || n > 999) {
          const err = new Error("Invalid bpm");
          err.status = 400;
          throw err;
        }
        data.bpm = n;
      }
    }
    if (req.body?.key !== undefined || req.body?.musicalKey !== undefined) {
      const v = req.body.key ?? req.body.musicalKey;
      data.musicalKey =
        v == null || v === ""
          ? null
          : String(v).trim().slice(0, 64) || null;
    }
    if (req.body?.notes !== undefined) {
      const v = req.body.notes;
      data.notes =
        v == null || v === ""
          ? null
          : String(v).trim().slice(0, 4000) || null;
    }
    if (req.body?.projectId !== undefined) {
      const v = req.body.projectId;
      if (v == null || v === "") {
        data.projectId = null;
      } else if (typeof v !== "string" || !UUID_RE.test(v)) {
        const err = new Error("Invalid projectId");
        err.status = 400;
        throw err;
      } else {
        const proj = await prisma.project.findFirst({
          where: { id: v, userId: req.user.id },
        });
        if (!proj) {
          const err = new Error("Project not found");
          err.status = 400;
          throw err;
        }
        data.projectId = proj.id;
      }
    }

    const updated = await prisma.track.update({
      where: { id: track.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    });
    res.json({ track: updated });
  } catch (e) {
    next(e);
  }
}

export async function getTrack(req, res, next) {
  try {
    const track = await prisma.track.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!track) {
      const err = new Error("Track not found");
      err.status = 404;
      throw err;
    }
    res.json({ track });
  } catch (e) {
    next(e);
  }
}

export async function deleteTrack(req, res, next) {
  try {
    const track = await prisma.track.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!track) {
      const err = new Error("Track not found");
      err.status = 404;
      throw err;
    }

    const root = resolveUploadRoot();
    const absPath = path.join(root, ...track.filepath.split("/"));

    await prisma.track.delete({ where: { id: track.id } });

    try {
      await fs.unlink(absPath);
    } catch (unlinkErr) {
      console.warn("[deleteTrack] unlink:", unlinkErr.message);
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

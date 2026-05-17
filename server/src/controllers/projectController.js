import { prisma } from "../lib/prisma.js";

const NAME_MAX = 200;
const DESC_MAX = 2000;

function trimStr(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

export async function createProject(req, res, next) {
  try {
    const name = trimStr(req.body?.name, NAME_MAX);
    if (!name) {
      const err = new Error("Project name is required");
      err.status = 400;
      throw err;
    }
    const description = trimStr(req.body?.description, DESC_MAX);

    const project = await prisma.project.create({
      data: {
        userId: req.user.id,
        name,
        description,
      },
    });
    res.status(201).json({ project: { ...project, trackCount: 0 } });
  } catch (e) {
    next(e);
  }
}

export async function listProjects(req, res, next) {
  try {
    const sort = req.query.sort === "name" ? "name" : "date";
    const order = req.query.order === "asc" ? "asc" : "desc";
    const orderBy =
      sort === "name" ? { name: order } : { updatedAt: order };

    const rows = await prisma.project.findMany({
      where: { userId: req.user.id },
      orderBy,
      include: { _count: { select: { tracks: true } } },
    });

    const projects = rows.map((p) => {
      const { _count, ...rest } = p;
      return { ...rest, trackCount: _count.tracks };
    });

    res.json({ projects });
  } catch (e) {
    next(e);
  }
}

export async function getProject(req, res, next) {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        tracks: {
          orderBy: { uploadedAt: "asc" },
        },
      },
    });
    if (!project) {
      const err = new Error("Project not found");
      err.status = 404;
      throw err;
    }
    const { tracks, ...meta } = project;
    res.json({
      project: {
        ...meta,
        trackCount: tracks.length,
        tracks,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function updateProject(req, res, next) {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) {
      const err = new Error("Project not found");
      err.status = 404;
      throw err;
    }

    const data = {};
    if (req.body?.name !== undefined) {
      const name = trimStr(req.body.name, NAME_MAX);
      if (!name) {
        const err = new Error("Project name cannot be empty");
        err.status = 400;
        throw err;
      }
      data.name = name;
    }
    if (req.body?.description !== undefined) {
      data.description = trimStr(req.body.description, DESC_MAX);
    }

    const project = await prisma.project.update({
      where: { id: existing.id },
      data,
      include: { _count: { select: { tracks: true } } },
    });
    const { _count, ...rest } = project;
    res.json({ project: { ...rest, trackCount: _count.tracks } });
  } catch (e) {
    next(e);
  }
}

export async function deleteProject(req, res, next) {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) {
      const err = new Error("Project not found");
      err.status = 404;
      throw err;
    }

    await prisma.project.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function addTracksToProject(req, res, next) {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!project) {
      const err = new Error("Project not found");
      err.status = 404;
      throw err;
    }

    const trackIds = Array.isArray(req.body?.trackIds)
      ? req.body.trackIds.filter((id) => typeof id === "string" && id.length > 0)
      : [];
    if (!trackIds.length) {
      const err = new Error("trackIds must be a non-empty array");
      err.status = 400;
      throw err;
    }

    const owned = await prisma.track.findMany({
      where: { userId: req.user.id, id: { in: trackIds } },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((t) => t.id));
    const missing = trackIds.filter((id) => !ownedSet.has(id));
    if (missing.length) {
      const err = new Error("Some tracks were not found or are not yours");
      err.status = 400;
      throw err;
    }

    await prisma.track.updateMany({
      where: { userId: req.user.id, id: { in: trackIds } },
      data: { projectId: project.id },
    });

    const updated = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        tracks: { orderBy: { uploadedAt: "asc" } },
        _count: { select: { tracks: true } },
      },
    });
    if (!updated) {
      const err = new Error("Project not found");
      err.status = 404;
      throw err;
    }
    const { _count, tracks, ...meta } = updated;
    res.json({
      project: {
        ...meta,
        trackCount: _count.tracks,
        tracks,
      },
    });
  } catch (e) {
    next(e);
  }
}

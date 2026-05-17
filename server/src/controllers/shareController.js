import { assertPrismaShareReady, prisma } from "../lib/prisma.js";
import { sendTrackStream } from "../utils/sendTrackStream.js";

function publicTrackShape(t) {
  if (!t) return null;
  return {
    id: t.id,
    originalName: t.originalName,
    title: t.title,
    artist: t.artist,
    duration: t.duration,
    format: t.format,
    filesize: t.filesize,
    bitrate: t.bitrate,
  };
}

function publicProjectShape(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    tracks: (p.tracks ?? []).map(publicTrackShape),
  };
}

function buildShareUrl(req, token) {
  const base = process.env.PUBLIC_SHARE_BASE_URL?.trim().replace(/\/$/, "");
  if (base) {
    return `${base}/share/${token}`;
  }
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  const host = req.get("host");
  if (host) {
    return `${proto}://${host}/share/${token}`;
  }
  return `/share/${token}`;
}

export async function createShare(req, res, next) {
  try {
    assertPrismaShareReady();
    const { type, id } = req.body ?? {};
    if (type !== "track" && type !== "project") {
      const err = new Error('type must be "track" or "project"');
      err.status = 400;
      throw err;
    }
    if (!id || typeof id !== "string") {
      const err = new Error("id is required");
      err.status = 400;
      throw err;
    }

    let expiresAt = null;
    const rawAt = req.body?.expiresAt;
    if (rawAt != null && rawAt !== "") {
      const d = new Date(String(rawAt));
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        const err = new Error("expiresAt must be a future date");
        err.status = 400;
        throw err;
      }
      expiresAt = d;
    } else if (
      req.body?.expiresIn != null &&
      req.body.expiresIn !== "" &&
      Number(req.body.expiresIn) > 0
    ) {
      const hours = Number(req.body.expiresIn);
      if (Number.isNaN(hours) || hours <= 0 || hours > 24 * 365 * 10) {
        const err = new Error("expiresIn must be a positive number of hours");
        err.status = 400;
        throw err;
      }
      expiresAt = new Date(Date.now() + hours * 3600_000);
    }

    const data = {
      userId: req.user.id,
      expiresAt,
      trackId: null,
      projectId: null,
    };

    if (type === "track") {
      const track = await prisma.track.findFirst({
        where: { id, userId: req.user.id },
      });
      if (!track) {
        const err = new Error("Track not found");
        err.status = 404;
        throw err;
      }
      data.trackId = track.id;
    } else {
      const project = await prisma.project.findFirst({
        where: { id, userId: req.user.id },
      });
      if (!project) {
        const err = new Error("Project not found");
        err.status = 404;
        throw err;
      }
      data.projectId = project.id;
    }

    const share = await prisma.share.create({
      data,
      include: {
        track: true,
        project: { include: { tracks: { orderBy: { uploadedAt: "asc" } } } },
      },
    });

    const url = buildShareUrl(req, share.token);
    res.status(201).json({
      share: {
        id: share.id,
        token: share.token,
        url,
        viewCount: share.viewCount,
        expiresAt: share.expiresAt,
        createdAt: share.createdAt,
        type: share.trackId ? "track" : "project",
        trackId: share.trackId,
        projectId: share.projectId,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function listShares(req, res, next) {
  try {
    assertPrismaShareReady();
    const rows = await prisma.share.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        track: { select: { id: true, originalName: true, title: true } },
        project: { select: { id: true, name: true } },
      },
    });

    const shares = rows.map((s) => ({
      id: s.id,
      token: s.token,
      url: buildShareUrl(req, s.token),
      viewCount: s.viewCount,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
      type: s.trackId ? "track" : "project",
      trackId: s.trackId,
      projectId: s.projectId,
      trackName: s.track
        ? (s.track.title?.trim() || s.track.originalName)
        : null,
      projectName: s.project?.name ?? null,
    }));

    res.json({ shares });
  } catch (e) {
    next(e);
  }
}

export async function revokeShare(req, res, next) {
  try {
    assertPrismaShareReady();
    const share = await prisma.share.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!share) {
      const err = new Error("Share not found");
      err.status = 404;
      throw err;
    }
    await prisma.share.delete({ where: { id: share.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function getPublicShare(req, res, next) {
  try {
    assertPrismaShareReady();
    const token = req.params.token;
    const share = await prisma.share.findUnique({
      where: { token },
      include: {
        track: true,
        project: {
          include: {
            tracks: { orderBy: { uploadedAt: "asc" } },
          },
        },
        user: { select: { id: true, username: true } },
      },
    });

    if (!share) {
      const err = new Error("This link is no longer available");
      err.status = 404;
      throw err;
    }

    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
      const err = new Error("This share link has expired");
      err.status = 410;
      throw err;
    }

    const updated = await prisma.share.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 } },
    });

    const ownerUsername = share.user?.username ?? "artist";
    const payload = {
      share: {
        token: share.token,
        viewCount: updated.viewCount,
        expiresAt: share.expiresAt,
        createdAt: share.createdAt,
        type: share.trackId ? "track" : "project",
      },
      owner: { username: ownerUsername },
      track: share.trackId ? publicTrackShape(share.track) : null,
      project: share.projectId ? publicProjectShape(share.project) : null,
    };

    res.json(payload);
  } catch (e) {
    next(e);
  }
}

export async function streamSharedTrack(req, res, next) {
  try {
    const share = req.share;
    let track = null;

    if (share.trackId) {
      track = await prisma.track.findUnique({ where: { id: share.trackId } });
    } else if (share.projectId) {
      const qtid =
        typeof req.query.trackId === "string" ? req.query.trackId.trim() : "";
      if (!qtid) {
        const err = new Error("trackId query parameter is required for project shares");
        err.status = 400;
        throw err;
      }
      track = await prisma.track.findFirst({
        where: { id: qtid, projectId: share.projectId },
      });
    }

    if (!track) {
      const err = new Error("Track not found");
      err.status = 404;
      throw err;
    }

    return sendTrackStream(req, res, next, track);
  } catch (e) {
    next(e);
  }
}

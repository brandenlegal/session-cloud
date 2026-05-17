import { assertPrismaShareReady, prisma } from "../lib/prisma.js";

/**
 * Load share by URL token, enforce expiration, attach `req.share`.
 * Does not increment view count (avoid inflating counts on each range/stream request).
 */
export async function requireValidShare(req, res, next) {
  try {
    assertPrismaShareReady();
    const token = req.params.token;
    if (!token || typeof token !== "string") {
      const err = new Error("Invalid share link");
      err.status = 404;
      throw err;
    }

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

    if (!share.trackId && !share.projectId) {
      const err = new Error("Invalid share");
      err.status = 500;
      throw err;
    }

    req.share = share;
    next();
  } catch (e) {
    next(e);
  }
}

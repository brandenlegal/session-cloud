import { prisma } from "../lib/prisma.js";
import { sendTrackStream } from "../utils/sendTrackStream.js";

export async function streamTrack(req, res, next) {
  try {
    const trackId = req.params.id;

    const track = await prisma.track.findFirst({
      where: { id: trackId },
    });

    if (!track) {
      const err = new Error("Track not found");
      err.status = 404;
      throw err;
    }

    if (track.userId !== req.user.id) {
      const err = new Error("You do not have access to this track");
      err.status = 403;
      throw err;
    }

    return sendTrackStream(req, res, next, track);
  } catch (e) {
    next(e);
  }
}

import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createUploadMiddleware } from "../middleware/upload.js";
import {
  deleteTrack,
  getTrack,
  listTracks,
  updateTrack,
  uploadTrack,
} from "../controllers/trackController.js";
import { streamTrack } from "../controllers/streamController.js";

export const tracksRouter = Router();

const upload = createUploadMiddleware();

tracksRouter.post(
  "/upload",
  upload.single("file"),
  asyncHandler(uploadTrack),
);
tracksRouter.get("/", asyncHandler(listTracks));

/** Must be registered before `GET /:id` so `/something/stream` is not captured as id only. */
tracksRouter.get(
  "/:id/stream",
  (req, _res, next) => {
    console.log("[tracks] GET /:id/stream hit", req.params.id);
    next();
  },
  asyncHandler(streamTrack),
);

tracksRouter.patch("/:id", asyncHandler(updateTrack));
tracksRouter.get("/:id", asyncHandler(getTrack));
tracksRouter.delete("/:id", asyncHandler(deleteTrack));

import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireValidShare } from "../middleware/shareAuth.js";
import {
  createShare,
  getPublicShare,
  listShares,
  revokeShare,
  streamSharedTrack,
} from "../controllers/shareController.js";

export const sharesRouter = Router();

/** Public — no auth */
sharesRouter.get("/public/:token", asyncHandler(getPublicShare));
sharesRouter.get(
  "/public/:token/stream",
  asyncHandler(requireValidShare),
  asyncHandler(streamSharedTrack),
);

/** Authenticated */
sharesRouter.post("/", asyncHandler(requireAuth), asyncHandler(createShare));
sharesRouter.get("/", asyncHandler(requireAuth), asyncHandler(listShares));
sharesRouter.delete(
  "/:id",
  asyncHandler(requireAuth),
  asyncHandler(revokeShare),
);

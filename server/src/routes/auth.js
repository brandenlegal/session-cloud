import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/dbReady.js";
import { login, register } from "../controllers/authController.js";

import { authLimiter } from "../middleware/rateLimits.js";

export const authRouter = Router();

authRouter.use(requireDatabase);

authRouter.post("/register", authLimiter, asyncHandler(register));
authRouter.post("/login", authLimiter, asyncHandler(login));

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler((req, res) => {
    res.json({ user: req.user });
  }),
);

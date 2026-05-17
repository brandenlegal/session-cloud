import rateLimit from "express-rate-limit";

/** Stricter limit for login/register (abuse protection). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts from this address. Please try again later." },
});

/** General API throttle (per IP). Health check is excluded. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const u = req.originalUrl?.split("?")[0] ?? "";
    if (u === "/api/health" || u.endsWith("/api/health")) return true;
    if (u.includes("/stream")) return true;
    return false;
  },
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

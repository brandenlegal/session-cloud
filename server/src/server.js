import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import { authRouter } from "./routes/auth.js";
import { tracksRouter } from "./routes/tracks.js";
import { projectsRouter } from "./routes/projects.js";
import { sharesRouter } from "./routes/shares.js";
import { requireAuth } from "./middleware/auth.js";
import { requireDatabase } from "./middleware/dbReady.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimits.js";

dotenv.config();

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function resolveCorsOrigin() {
  const raw = process.env.CLIENT_ORIGIN?.trim();
  if (!raw) {
    return process.env.NODE_ENV !== "production" ? DEFAULT_DEV_ORIGINS : true;
  }
  const fromEnv = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (process.env.NODE_ENV !== "production") {
    return [...new Set([...DEFAULT_DEV_ORIGINS, ...fromEnv])];
  }
  return fromEnv.length === 1 ? fromEnv[0] : fromEnv;
}

const corsOrigin = resolveCorsOrigin();

if (process.env.NODE_ENV === "production") {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
}

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    exposedHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Range",
      "Accept",
      "X-Requested-With",
    ],
  }),
);

app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      const u = req.originalUrl ?? "";
      if (u.includes("/stream")) return false;
      return compression.filter(req, res);
    },
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/api", apiLimiter);

app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

app.use("/api/auth", authRouter);
app.use("/api/tracks", requireDatabase, requireAuth, tracksRouter);
app.use("/api/projects", requireDatabase, requireAuth, projectsRouter);
app.use("/api/shares", requireDatabase, sharesRouter);

app.get("/api/health", (_req, res, next) => {
  try {
    res.json({
      ok: true,
      service: "session-cloud-api",
      uptime: process.uptime(),
      env: process.env.NODE_ENV ?? "development",
    });
  } catch (err) {
    console.error("[GET /api/health] unexpected error:", err);
    next(err);
  }
});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`  Health: http://127.0.0.1:${PORT}/api/health`);
  if (process.env.NODE_ENV !== "production") {
    console.log(`  CORS origins:`, corsOrigin);
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

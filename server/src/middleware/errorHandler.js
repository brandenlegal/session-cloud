import { isDatabaseConnectionError } from "../utils/dbErrors.js";

export function errorHandler(err, _req, res, _next) {
  if (isDatabaseConnectionError(err)) {
    console.error("[database]", err.message ?? err);
    return res.status(503).json({
      error:
        "Database not available. Check DATABASE_URL (Supabase or Railway) and that the database is running, then try again.",
    });
  }

  if (err?.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large (max 100MB per file)" });
    }
    console.warn("[multer]", err.code, err.message);
    return res.status(400).json({ error: err.message || "Upload error" });
  }

  const status = err.status ?? err.statusCode ?? 500;
  let message = err.message ?? "Internal server error";

  if (status === 500 && process.env.NODE_ENV === "production") {
    message = "Internal server error";
  }

  if (status >= 500) {
    console.error("[errorHandler]", err);
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("[errorHandler]", status, message);
  }

  res.status(status).json({ error: message });
}

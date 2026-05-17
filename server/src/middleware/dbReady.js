const DB_NOT_CONFIGURED =
  "Database not configured. Add DATABASE_URL from Supabase or Railway (see server/.env.example and README).";

export function requireDatabase(_req, res, next) {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return res.status(503).json({ error: DB_NOT_CONFIGURED });
  }
  next();
}

import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../utils/jwt.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const bearer =
      header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
    const queryToken =
      typeof req.query?.access_token === "string"
        ? req.query.access_token.trim()
        : null;
    const token = bearer || queryToken;

    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = payload.sub;
    if (!userId || typeof userId !== "string") {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, createdAt: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

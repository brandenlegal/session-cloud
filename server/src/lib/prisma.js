import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

/**
 * After `prisma generate`, an old PrismaClient cached on `globalThis` may lack new
 * models (e.g. `share`). Drop it in dev so the next import gets a fresh client.
 */
function getOrCreateClient() {
  const existing = globalForPrisma.prisma;
  const stale =
    existing &&
    typeof existing.share?.create !== "function";
  if (stale) {
    try {
      void existing.$disconnect();
    } catch {
      /* ignore */
    }
    globalForPrisma.prisma = undefined;
    return new PrismaClient();
  }
  return existing ?? new PrismaClient();
}

export const prisma = getOrCreateClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Throws 503-style error if Share model is missing from the generated client. */
export function assertPrismaShareReady() {
  if (!prisma.share || typeof prisma.share.create !== "function") {
    const err = new Error(
      "Share is not available: from the server folder run `npx prisma db push` and `npx prisma generate`, then restart the API.",
    );
    err.status = 503;
    throw err;
  }
}

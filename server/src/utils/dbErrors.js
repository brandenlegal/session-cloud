/**
 * Returns true when Prisma failed to connect or reach the database.
 */
export function isDatabaseConnectionError(err) {
  if (!err) return false;
  const code = err.code;
  if (code === "P1001" || code === "P1000" || code === "P1017") {
    return true;
  }
  if (err.name === "PrismaClientInitializationError") {
    return true;
  }
  const msg = String(err.message ?? "");
  if (msg.includes("Can't reach database server")) return true;
  if (msg.includes("Database `") && msg.includes("does not exist")) {
    return true;
  }
  return false;
}

/** Prefer user-edited title when present. */
export function trackDisplayName(t) {
  if (!t) return "";
  const title = typeof t.title === "string" ? t.title.trim() : "";
  return title || t.originalName || "";
}

/** Lightweight route loading fallback (avoids layout shift). */
export function PageSkeleton({ label = "Loading…" }) {
  return (
    <div
      className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-4 py-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2/80" />
      <div className="h-4 w-full max-w-md animate-pulse rounded bg-surface-2/60" />
      <div className="mt-6 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-14 w-full animate-pulse rounded-xl bg-surface-2/50"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

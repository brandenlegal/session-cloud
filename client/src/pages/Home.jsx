import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../lib/api.js";
import { isAuthenticated } from "../lib/auth.js";

export default function Home() {
  const authed = isAuthenticated();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/health");
        if (!cancelled) setHealth(data);
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.error ?? e.message ?? "Request failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (authed) {
    return <Navigate to="/library" replace />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-4 py-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-fg">Session Cloud</h1>
        <p className="mt-2 text-muted">
          Cloud library for your production sessions. Sign in to continue.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/login"
          className="rounded-lg bg-linear-to-r from-cyan-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110"
        >
          Sign in
        </Link>
        <Link
          to="/register"
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted transition hover:border-cyan-500/40 hover:text-fg"
        >
          Register
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 font-mono text-sm backdrop-blur-sm">
        <p className="text-muted">GET /api/health</p>
        {error ? (
          <p className="mt-2 text-red-400">{error}</p>
        ) : health ? (
          <pre className="mt-2 overflow-x-auto text-cyan-400">
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : (
          <p className="mt-2 text-muted">Loading…</p>
        )}
      </div>
    </div>
  );
}

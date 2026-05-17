import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { isAuthenticated } from "../lib/auth.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState(null);

  if (isAuthenticated()) {
    return <Navigate to="/library" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFieldError(null);

    if (!email.trim() || !password) {
      setFieldError("Enter your email and password.");
      return;
    }

    try {
      await login(email, password);
      const to = location.state?.from?.pathname ?? "/library";
      navigate(to, { replace: true });
    } catch {
      /* toast handled in useAuth */
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-fg">Session Cloud</h1>
        <p className="mt-2 text-muted">Sign in to your account</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-border bg-surface-2/80 p-8 shadow-xl shadow-cyan-950/20 backdrop-blur-sm transition-colors duration-200"
      >
        {fieldError ? (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {fieldError}
          </p>
        ) : null}

        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-fg outline-none ring-cyan-400/30 transition focus:border-cyan-500/50 focus:ring-2"
            placeholder="you@example.com"
            disabled={loading}
          />
        </label>

        <label className="mb-6 block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-fg outline-none ring-cyan-400/30 transition focus:border-cyan-500/50 focus:ring-2"
            placeholder="••••••••"
            disabled={loading}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-linear-to-r from-cyan-600 to-cyan-500 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition enabled:hover:brightness-110 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-6 text-center text-sm text-muted">
          No account?{" "}
          <Link
            to="/register"
            className="font-medium text-cyan-400 underline-offset-4 transition hover:text-cyan-300 hover:underline"
          >
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}

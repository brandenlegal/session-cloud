import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { isAuthenticated } from "../lib/auth.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const { register, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState(null);

  if (isAuthenticated()) {
    return <Navigate to="/library" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFieldError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setFieldError("Please enter a valid email address.");
      return;
    }
    if (username.trim().length < 3) {
      setFieldError("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFieldError("Passwords do not match.");
      return;
    }

    try {
      await register({
        email: email.trim(),
        username: username.trim(),
        password,
      });
      navigate("/library", { replace: true });
    } catch {
      /* toast in useAuth */
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-fg">Create account</h1>
        <p className="mt-2 text-muted">Join Session Cloud</p>
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
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-fg outline-none ring-cyan-400/30 transition focus:border-cyan-500/50 focus:ring-2"
            placeholder="you@example.com"
            disabled={loading}
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Username</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-fg outline-none ring-cyan-400/30 transition focus:border-cyan-500/50 focus:ring-2"
            placeholder="producer_name"
            minLength={3}
            disabled={loading}
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-fg outline-none ring-cyan-400/30 transition focus:border-cyan-500/50 focus:ring-2"
            placeholder="Min. 8 characters"
            disabled={loading}
          />
        </label>

        <label className="mb-6 block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-fg outline-none ring-cyan-400/30 transition focus:border-cyan-500/50 focus:ring-2"
            placeholder="Repeat password"
            disabled={loading}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-linear-to-r from-cyan-600 to-cyan-500 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition enabled:hover:brightness-110 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Register"}
        </button>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-cyan-400 underline-offset-4 transition hover:text-cyan-300 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

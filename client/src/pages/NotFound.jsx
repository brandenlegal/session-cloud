import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400/90">
        404
      </p>
      <h1 className="mt-3 text-2xl font-bold text-fg">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        That URL does not exist or was moved. Check the link or head back home.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex min-h-11 min-w-36 items-center justify-center rounded-lg bg-cyan-600 px-6 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
      >
        Go home
      </Link>
    </div>
  );
}

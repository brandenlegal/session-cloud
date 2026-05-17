import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const BASE = "Session Cloud";

const TITLES = {
  "/": "Home",
  "/login": "Sign in",
  "/register": "Register",
  "/library": "Library",
  "/upload": "Upload",
  "/projects": "Projects",
  "/dashboard": "Dashboard",
};

export function AppDocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    let section = TITLES[pathname];
    if (!section) {
      if (pathname.startsWith("/projects/")) section = "Project";
      else if (pathname.startsWith("/share/")) section = "Shared audio";
    }
    document.title = section ? `${section} · ${BASE}` : BASE;
  }, [pathname]);

  return null;
}

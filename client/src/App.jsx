import { lazy, Suspense, useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { isAuthenticated } from "./lib/auth.js";
import { AppDocumentTitle } from "./components/AppDocumentTitle.jsx";
import { PageSkeleton } from "./components/PageSkeleton.jsx";
import { AudioPlayer } from "./components/AudioPlayer.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Library = lazy(() => import("./pages/Library.jsx"));
const Upload = lazy(() => import("./pages/Upload.jsx"));
const Projects = lazy(() => import("./pages/Projects.jsx"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail.jsx"));
const Share = lazy(() => import("./pages/Share.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

function ProtectedLayout() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return (
    <>
      <Outlet />
      <AudioPlayer />
    </>
  );
}

function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] border-b border-amber-500/40 bg-amber-950/90 px-4 py-2 text-center text-sm text-amber-100 backdrop-blur-sm"
      role="status"
    >
      You are offline. Reconnect to upload, sign in, or refresh data.
    </div>
  );
}

export default function App() {
  return (
    <>
      <OfflineBanner />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          className: "session-toast",
          style: {
            background: "oklch(0.22 0.04 250)",
            color: "oklch(0.95 0.02 250)",
            border: "1px solid oklch(0.35 0.06 220)",
          },
        }}
      />
      <AppDocumentTitle />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/share/:token" element={<Share />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/library" element={<Library />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

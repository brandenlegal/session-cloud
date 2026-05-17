import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Shared by `vite dev` and `vite preview` so `/api/*` always reaches the backend. */
function apiProxy() {
  return {
    target: "http://127.0.0.1:5000",
    changeOrigin: true,
    timeout: 600_000,
    proxyTimeout: 600_000,
    configure(proxy) {
      proxy.on("proxyReq", (_proxyReq, req) => {
        if (req.url?.includes("/stream")) {
          console.log(
            "[vite proxy → API]",
            req.method,
            req.url,
            req.headers.authorization ? "(Authorization)" : "(no Authorization)",
          );
        }
      });
      proxy.on("proxyRes", (proxyRes, req) => {
        if (req.url?.includes("/stream")) {
          console.log(
            "[vite proxy ← API]",
            req.method,
            req.url,
            "→",
            proxyRes.statusCode,
          );
        }
      });
      proxy.on("error", (err, _req, res) => {
        const msg = err?.message ?? String(err);
        console.error(
          "\n[vite proxy] Cannot reach API at http://127.0.0.1:5000 — start the backend:\n  cd server && npm run dev\n",
          "Reason:",
          msg,
          "\n",
        );
        if (res && !res.headersSent && typeof res.writeHead === "function") {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error:
                "API server unreachable. From the server folder run: npm run dev (port 5000).",
              detail: msg,
            }),
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": apiProxy(),
    },
  },
  preview: {
    proxy: {
      "/api": apiProxy(),
    },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("wavesurfer")) return "wavesurfer";
          if (id.includes("react-dom") || id.includes("react-router")) return "react-vendor";
          if (id.includes("react")) return "react-core";
          if (id.includes("axios")) return "http";
          return "vendor";
        },
      },
    },
  },
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));

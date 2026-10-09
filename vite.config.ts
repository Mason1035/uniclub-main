import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Read .env / .env.local so the backend origin can be configured in one place.
  const env = loadEnv(mode, process.cwd(), '');
  // Backend origin used by the dev proxy. Defaults to the standard port; override
  // with VITE_API_PROXY_TARGET when the API has to run elsewhere
  // (e.g. macOS AirPlay Receiver already owns port 5000).
  const apiProxyTarget =
    process.env.VITE_API_PROXY_TARGET || env.VITE_API_PROXY_TARGET || "http://localhost:5050";

  return {
    cacheDir: process.env.VITE_CACHE_DIR || "node_modules/.vite",
    // Keep generated files separate from public/Assets on case-sensitive Linux.
    build: { assetsDir: 'static', manifest: true },
    server: {
      host: '0.0.0.0',
      port: Number(process.env.VITE_PORT || 8081),
      strictPort: true,
      hmr: {
        port: Number(process.env.VITE_PORT || 8081),
      },
      proxy: {
        '/uploads': { target: apiProxyTarget, changeOrigin: true },
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [
      react(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

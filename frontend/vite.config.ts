import { createRequire } from "node:module";
import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig, normalizePath } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const require = createRequire(import.meta.url);

// Absolute site URL for the Open Graph tags in index.html (%VITE_PUBLIC_URL%)
process.env.VITE_PUBLIC_URL ??= "https://catsight.mjcarnaje.com";

const pdfjsDistPath = path.dirname(require.resolve("pdfjs-dist/package.json"));
const cMapsDir = normalizePath(path.join(pdfjsDistPath, "cmaps"));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: cMapsDir,
          dest: "public/pdfjs/cmaps",
        },
      ],
    }),
  ],
  preview: {
    port: 3000,
    host: "0.0.0.0",
  },
  server: {
    port: 3000,
    strictPort: true,
    host: "0.0.0.0",
    // In Docker the API is reachable as backend:8000; outside it, set API_URL=http://localhost:8000
    proxy: {
      "/api": { target: process.env.API_URL ?? "http://backend:8000", changeOrigin: true },
      "/media": { target: process.env.API_URL ?? "http://backend:8000", changeOrigin: true },
    },
    watch: {
      usePolling: true,
    },
    hmr: {
      host: "localhost",
    },
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

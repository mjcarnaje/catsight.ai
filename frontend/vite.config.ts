import { createRequire } from "node:module";
import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig, normalizePath } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const require = createRequire(import.meta.url);

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
    watch: {
      usePolling: true,
    },
    hmr: {
      host: "localhost",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

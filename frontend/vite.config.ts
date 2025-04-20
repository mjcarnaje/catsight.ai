import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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

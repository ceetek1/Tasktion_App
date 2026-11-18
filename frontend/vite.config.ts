import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The API paths the dev server forwards to a local FastAPI on :8000
const API = ["/auth", "/tasks", "/planner", "/tokens", "/courses", "/classes", "/goals", "/focus-sessions", "/term", "/bosses", "/js/config.js", "/manifest.json", "/icons"];

export default defineConfig({
  plugins: [react()],
  // FastAPI serves the build from public/app at /app/
  base: "/app/",
  build: { outDir: "../public/app", emptyOutDir: true },
  server: {
    proxy: Object.fromEntries(API.map((path) => [path, "http://127.0.0.1:8000"])),
    // node_modules may be a link to a folder outside the project
    fs: { strict: false },
  },
  test: { include: ["src/**/*.test.ts"] },
});

import path from "node:path";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests don't start the Electron build plugins.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    include: ["{electron,shared,src}/**/*.test.ts"],
  },
});

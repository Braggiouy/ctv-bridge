import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    alias: {
      electron: path.resolve(__dirname, "test/mocks/electron.ts"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["electron/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
  },
});

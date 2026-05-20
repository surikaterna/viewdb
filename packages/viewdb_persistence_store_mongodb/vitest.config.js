import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    globalSetup: "./globalSetup.js",
    setupFiles: ["./vitest.setup.js"],
    include: ["__tests__/**/*.js"],
  },
});

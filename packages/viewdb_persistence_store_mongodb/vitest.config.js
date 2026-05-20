import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    globalSetup: "./globalSetup.ts",
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.ts"],
  },
});

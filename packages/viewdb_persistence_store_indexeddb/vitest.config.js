import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["test/collection.ts", "test/shared.ts"],
  },
});

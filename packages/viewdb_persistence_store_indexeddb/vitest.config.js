import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    include: ["test/IndexedDBCollection.ts", "test/IndexedDBStore.shared.ts"],
  },
});

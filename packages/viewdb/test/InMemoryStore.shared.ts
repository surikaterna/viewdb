import { runStoreTests } from "viewdb-store-tests";
import { InMemoryStore } from "../src";

runStoreTests({
  name: "inmemory",
  createStore: async () => {
    return new InMemoryStore();
  },
  destroyStore: async (store) => {
    await store.collection("test_shared").deleteMany();
  },
  suites: ["crud", "query", "cursor", "count"],
});

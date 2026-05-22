import { runStoreTests } from "viewdb-store-tests";
import { LokiJSStore } from "../src";

runStoreTests({
  name: "lokijs",
  createStore: async () => {
    const store = new LokiJSStore("test-shared", { inMemoryOnly: true, disableThrottle: true });
    await store.open();
    return store;
  },
  destroyStore: async (store) => {
    await store.collection("test_shared").drop();
    await store.close();
    store.clearAllIntervals();
  },
  suites: ["crud", "query", "cursor", "count", "observe"],
  observeOptions: {
    settleDelay: 50,
  },
});

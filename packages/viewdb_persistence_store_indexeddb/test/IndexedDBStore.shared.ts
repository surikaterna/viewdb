import { runStoreTests } from "viewdb-store-tests";
import IndexedDBStore from "../src/IndexedDBStore";
import getDb from "./util";

runStoreTests({
  name: "indexeddb",
  createStore: async () => {
    const idb = getDb();
    const store = new IndexedDBStore(idb);
    await store.open();
    return store;
  },
  destroyStore: async (store) => {
    await store.close();
    const idb = store._idb;
    idb._databases.clear();
  },
  suites: ["crud", "query", "cursor", "count"],
});

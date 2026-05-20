import { runStoreTests } from "viewdb-store-tests";
import IndexedDBStore from "../src/IndexedDBStore";
import getDb from "./util";

runStoreTests({
  name: "indexeddb",
  createStore: function (done) {
    const idb = getDb();
    const store = new IndexedDBStore(idb);
    store.open().then(function () {
      done(store);
    });
  },
  destroyStore: function (store, done) {
    store.close().then(function () {
      const idb = store._idb;
      idb._databases.clear();
      done();
    });
  },
  suites: ["crud", "query", "cursor", "count"],
});

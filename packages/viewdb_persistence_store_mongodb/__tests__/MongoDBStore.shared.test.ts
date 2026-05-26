import { type Db, MongoClient } from "mongodb";
import { runStoreTests } from "viewdb-store-tests";
import { MongoDBStore } from "../src";

let mongoClient: MongoClient;
let db: Db;

runStoreTests({
  name: "mongodb",
  initialize: async () => {
    mongoClient = await MongoClient.connect(global.__MONGO_URI__);
    db = mongoClient.db("test_shared");
  },
  cleanup: async () => {
    await mongoClient.close();
  },
  createStore: async () => {
    const store = new MongoDBStore(db);
    await store.open();
    return store;
  },
  destroyStore: async () => {
    try {
      await db.collection("test_shared").drop();
    } catch {
      // no-op
    }
  },
  observeOptions: {
    settleDelay: 50,
  },
});

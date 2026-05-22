import _ from "lodash";
import { MongoClient } from "mongodb";
import { ViewDB } from "viewdb";
import MongoDBStore from "../src/MongoDBStore";

describe("Observe", () => {
  const COLLECTION_NAME = "observe";

  let _mongoClient;
  let _db;

  const getDb = () => _db;
  const getVDb = () => new ViewDB(new MongoDBStore(getDb()));

  beforeAll(async () => {
    const mongoClient = await MongoClient.connect(global.__MONGO_URI__);
    const db = await mongoClient.db("db_test_suite");

    _mongoClient = mongoClient;
    _db = db;
  });

  beforeEach(async () => {
    try {
      await _db.collection(COLLECTION_NAME).drop();
    } catch (err) {
      // No-op
    }
  });

  afterAll(async () => {
    await _mongoClient.close();
  });

  it("#observe with query and update", () =>
    new Promise<void>((resolve) => {
      const store = getVDb();
      store.open().then(() => {
        const cursor = store.collection(COLLECTION_NAME).find({ _id: "echo" });
        const handle = cursor.observe({
          added: (x) => {
            expect(x.age).toBe(10);
            expect(x._id).toBe("echo");
          },
          changed: (asis, tobe) => {
            expect(asis.age).toBe(10);
            expect(tobe.age).toBe(100);
            handle.stop();
            resolve();
          },
        });
        store.collection(COLLECTION_NAME).insert({ _id: "echo", age: 10 }, () => {
          store.collection(COLLECTION_NAME).save({ _id: "echo", age: 100 }, () => {});
        });
      });
    }));
  it("#observe with insert", () =>
    new Promise<void>((resolve) => {
      let handle;
      const store = getVDb();
      store.open().then(() => {
        const collection = store.collection(COLLECTION_NAME);
        const cursor = collection.find({});
        handle = cursor.observe({
          added: (x) => {
            expect(x._id).toBe("echo");
            handle.stop();
            resolve();
          },
        });
        collection.insert({ _id: "echo" });
      });
    }));
  it("#observe with remove", () =>
    new Promise<void>((resolve) => {
      const realDone = _.after(2, resolve);
      const store = getVDb();
      store.open().then(() => {
        const cursor = store.collection(COLLECTION_NAME).find({});
        const handle = cursor.observe({
          added: (x) => {
            expect(x._id).toBe("echo");
            realDone();
          },
          removed: () => {
            handle.stop();
            realDone();
          },
        });
        const coll = store.collection(COLLECTION_NAME);
        coll.insert({ _id: "echo" }, () => {
          coll.remove({ _id: "echo" }, () => {});
        });
      });
    }));
  it("#observe with query and insert", () =>
    new Promise<void>((resolve) => {
      const store = getVDb();
      store.open().then(() => {
        store.collection(COLLECTION_NAME).insert({ _id: "echo1" }, () => {
          const cursor = store.collection(COLLECTION_NAME).find({ _id: "echo2" });
          const handle = cursor.observe({
            added: (x) => {
              expect(x._id).toBe("echo2");
              resolve();
              handle.stop();
            },
          });
        });
        store.collection(COLLECTION_NAME).insert({ _id: "echo4" }, () => {
          store.collection(COLLECTION_NAME).insert({ _id: "echo2" });
        });
      });
    }));
  it("#observe with query and skip", () =>
    new Promise<void>((resolve) => {
      const store = getVDb();
      store.open().then(() => {
        store.collection(COLLECTION_NAME).insert({ _id: "echo" });
        store.collection(COLLECTION_NAME).insert({ _id: "echo2" });
        store.collection(COLLECTION_NAME).insert({ _id: "echo3" });
        const cursor = store.collection(COLLECTION_NAME).find({});
        let skip = 0;
        cursor.limit(1);
        const realDone = _.after(3, () => {
          cursor.toArray((_err, res) => {
            expect(res).toHaveLength(0);
            handle.stop();
            resolve();
          });
        });

        const handle = cursor.observe({
          added: () => {
            cursor.skip(++skip);
            realDone();
          },
        });
      });
    }));
});

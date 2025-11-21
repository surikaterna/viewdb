import { type Db, MongoClient } from "mongodb";
import ViewDB, { type ViewDBCollection } from "viewdb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoDBStore } from "./MongoDBStore";

describe("Observe", () => {
  type Doc = {
    _id: string;
    age?: number;
  };

  let mongoClient: MongoClient;
  let db: Db;
  let store: ViewDB;
  let collection: ViewDBCollection<Doc>;

  const getDb = () => db;
  const createViewDB = () => new ViewDB(new MongoDBStore(getDb()));

  beforeAll(async () => {
    mongoClient = await MongoClient.connect(global.__MONGO_URI__);
    db = mongoClient.db("db_test_suite");
  });

  beforeEach(async () => {
    const collectionName = "observe";
    try {
      await db.collection(collectionName).drop();
    } catch {}

    store = createViewDB();
    collection = store.collection<Doc>(collectionName);
    await store.open();
  });

  afterAll(async () => {
    await mongoClient.close();
  });

  it("#observe with query and update", async () => {
    const cursor = collection.find({ _id: "echo" });

    const promise = new Promise<void>((resolve) => {
      const handle = cursor.observe({
        added: (newDoc) => {
          expect(newDoc.age).toBe(10);
          expect(newDoc._id).toBe("echo");
        },
        changed: (prevDoc, newDoc) => {
          expect(prevDoc.age).toBe(10);
          expect(newDoc.age).toBe(100);
          handle.stop();

          resolve();
        },
      });
    });

    await collection.insert({ _id: "echo", age: 10 });
    await collection.save({ _id: "echo", age: 100 });

    await promise;
  });

  it("#observe with insert", async () => {
    const cursor = collection.find({});

    const observePromise = new Promise<void>((resolve) => {
      const handle = cursor.observe({
        added: (x) => {
          expect(x._id).toBe("echo");
          handle.stop();
          resolve();
        },
      });
    });

    await collection.insert({ _id: "echo" });
    await observePromise;
  });

  it("#observe with remove", async () => {
    const cursor = collection.find({});

    const observePromise = new Promise<void>((resolve) => {
      const handle = cursor.observe({
        added: (x) => {
          expect(x._id).toBe("echo");
        },
        removed: () => {
          handle.stop();
          resolve();
        },
      });
    });

    await collection.insert({ _id: "echo" });
    await collection.remove({ _id: "echo" });
    await observePromise;
  });

  it("#observe with query and insert", async () => {
    await collection.insert({ _id: "echo1" });
    const cursor = collection.find({ _id: "echo2" });

    const observePromise = new Promise<void>((resolve) => {
      const handle = cursor.observe({
        added: (newDoc) => {
          expect(newDoc._id).toBe("echo2");
          handle.stop();
          resolve();
        },
      });
    });

    await collection.insert({ _id: "echo4" });
    await collection.insert({ _id: "echo2" });
    await observePromise;
  });

  it("#observe with query and skip", async () => {
    await collection.insert({ _id: "echo" });
    await collection.insert({ _id: "echo2" });
    await collection.insert({ _id: "echo3" });
    const cursor = collection.find({});

    let skip = 0;

    const observePromise = new Promise<void>((resolve) => {
      const handle = cursor.observe({
        added: () => {
          cursor.skip(++skip);

          if (skip === 2) {
            handle.stop();
            resolve();
          }
        },
      });
    });

    cursor.limit(1);
    await observePromise;

    const res = await cursor.toArray();
    expect(res).toHaveLength(0);
  });
});

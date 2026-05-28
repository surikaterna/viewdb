import _ from "lodash";
import { type Db, MongoClient } from "mongodb";
import { type Collection, ViewDB } from "viewdb";
import MongoDBStore from "../src/MongoDBStore";

describe("Observe", () => {
  const COLLECTION_NAME = "observe";

  let mongoClient: MongoClient;
  let db: Db;
  let collection: Collection;

  const getDb = () => db;
  const getVDb = () => new ViewDB(new MongoDBStore(getDb()));

  beforeAll(async () => {
    mongoClient = await MongoClient.connect(global.__MONGO_URI__);
    db = mongoClient.db("db_test_suite");
  });

  beforeEach(async () => {
    try {
      await db.collection(COLLECTION_NAME).drop();
    } catch {
      // in case ns does not exist yet
    }

    const store = getVDb();
    await store.open();
    collection = store.collection(COLLECTION_NAME);
  });

  afterAll(async () => {
    await mongoClient.close();
  });

  it("#observe with query and update", async () => {
    const cursor = collection.find({ _id: "echo" });

    return new Promise<void>((resolve) => {
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

      collection.insert({ _id: "echo", age: 10 }).then(() => {
        collection.save({ _id: "echo", age: 100 });
      });
    });
  });

  it("#observe with insert", async () => {
    const cursor = collection.find({});

    return new Promise<void>((resolve) => {
      const handle = cursor.observe({
        added: (x) => {
          expect(x._id).toBe("echo");
          handle.stop();
          resolve();
        },
      });

      collection.insert({ _id: "echo" });
    });
  });

  it("#observe with remove", async () => {
    const cursor = collection.find({});

    return new Promise<void>((resolve) => {
      const done = _.after(2, resolve);

      const handle = cursor.observe({
        added: (x) => {
          expect(x._id).toBe("echo");
          done();
        },
        removed: () => {
          handle.stop();
          done();
        },
      });

      collection.insert({ _id: "echo" }).then(() => {
        collection.remove({ _id: "echo" });
      });
    });
  });

  it("#observe with query and insert", async () => {
    return new Promise<void>((resolve) => {
      collection.insert({ _id: "echo1" }).then(() => {
        const cursor = collection.find({ _id: "echo2" });
        const handle = cursor.observe({
          added: (x) => {
            expect(x._id).toBe("echo2");
            resolve();
            handle.stop();
          },
        });
      });

      collection.insert({ _id: "echo4" }).then(() => {
        collection.insert({ _id: "echo2" });
      });
    });
  });
  it("#observe with query and skip", async () => {
    await collection.insert({ _id: "echo" });
    await collection.insert({ _id: "echo2" });
    await collection.insert({ _id: "echo3" });
    const cursor = collection.find({});

    return new Promise<void>((resolve) => {
      let skip = 0;
      cursor.limit(1);
      const done = _.after(3, () => {
        cursor.toArray().then((res) => {
          expect(res).toHaveLength(0);
          handle.stop();
          resolve();
        });
      });

      const handle = cursor.observe({
        added: () => {
          cursor.skip(++skip);
          done();
        },
      });
    });
  });
});

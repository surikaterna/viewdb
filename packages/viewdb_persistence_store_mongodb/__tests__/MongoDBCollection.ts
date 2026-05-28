import { type Db, MongoClient, ReadPreference } from "mongodb";
import type MongoDBCollection from "../src/MongoDBCollection";
import MongoDBStore from "../src/MongoDBStore";

const Store = MongoDBStore;

describe("mongodb_persistence", () => {
  const COLLECTION_NAME = "collection";
  let mongoClient: MongoClient;
  let db: Db;
  let collection: MongoDBCollection;

  const getDb = () => db;

  beforeAll(async () => {
    mongoClient = await MongoClient.connect(global.__MONGO_URI__);
    db = mongoClient.db("db_test_suite_collection");
  });

  beforeEach(async () => {
    try {
      await db.collection(COLLECTION_NAME)?.drop();
    } catch {
      // in case ns does not exist yet
    }
    const store = new Store(getDb());
    await store.open();
    collection = store.collection(COLLECTION_NAME);
  });

  afterAll(async () => {
    await mongoClient.close();
  });

  describe("Collection", () => {
    it("#find with empty array should return 0 docs", async () => {
      const results = await collection.find({}).toArray();
      expect(results).toHaveLength(0);
    });

    it("#find with setReadPreference", async () => {
      const cursor = collection.find({});
      cursor.setReadPreference(ReadPreference.PRIMARY);
      const results = await cursor.toArray();
      expect(results).toHaveLength(0);
    });

    it("#insert two documents with same key should throw", async () => {
      await collection.insert({ _id: "echo" });
      await expect(() => collection.insert({ _id: "echo" })).rejects.toThrow("E11000 duplicate key error collection");
    });

    it("#update documents already existing", async () => {
      await collection.insert({ _id: "existing" });
      await collection.save({ _id: "existing", version: 2 });

      const results = await collection.find({}).toArray();

      expect(results).toHaveLength(1);
      expect(results[0].version).toBe(2);
    });

    it("#update one document", async () => {
      await collection.insert({ _id: "existing" });
      await collection.updateOne({ _id: "existing" }, { $set: { _id: "existing", name: "john" } });

      const results = await collection.find({}).toArray();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("john");
    });

    it("#findAndModify upsert", async () => {
      const filter = { _id: "not-existing" };
      const sort = {};
      const update = {
        $setOnInsert: { test: 1 },
        $push: {
          events: { event: 1, test: 2 },
          references: { $each: [{ ref: 1 }, { ref: 2 }, { ref: 3 }] },
        },
      };
      const options = { upsert: true };
      await collection.findAndModify(filter, sort, update, options);
      const results = await collection.find({}).toArray();
      expect(results).toHaveLength(1);
      expect(results[0]).toStrictEqual({
        _id: "not-existing",
        events: [{ event: 1, test: 2 }],
        references: [{ ref: 1 }, { ref: 2 }, { ref: 3 }],
        test: 1,
      });
    });

    it("#findAndModify modify", async () => {
      const filter = { _id: "not-existing" };
      const sort = {};
      const update = {
        $setOnInsert: { test: 1 },
        $push: {
          events: { event: 1, test: 2 },
          references: { $each: [{ ref: 1 }, { ref: 2 }, { ref: 3 }] },
        },
      };
      const options = { upsert: true };
      await collection.save({ _id: "not-existing", test: 2, events: [{ event: 10, test: 3 }], references: [] });
      await collection.findAndModify(filter, sort, update, options);
      const results = await collection.find({}).toArray();
      expect(results).toHaveLength(1);
      expect(results[0]).toStrictEqual({
        _id: "not-existing",
        events: [
          { event: 10, test: 3 },
          { event: 1, test: 2 },
        ],
        references: [{ ref: 1 }, { ref: 2 }, { ref: 3 }],
        test: 2,
      });
    });

    it("#update many documents", async () => {
      await collection.insert([
        { _id: "existing1", name: "john" },
        { _id: "existing2", name: "john" },
      ]);

      await collection.updateMany({ name: "john" }, { $set: { lastName: "connor" } });
      const results = await collection.find({}).toArray();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        _id: "existing1",
        name: "john",
        lastName: "connor",
      });
      expect(results[1]).toEqual({
        _id: "existing2",
        name: "john",
        lastName: "connor",
      });
    });

    it("#find {} should return single inserted document", async () => {
      await collection.insert({ _id: "echo" });
      const results = await collection.find({}).toArray();

      expect(results).toHaveLength(1);
    });

    it("#find {} should return multiple inserted documents", async () => {
      await collection.insert([{ _id: "echo" }, { _id: "sierra" }]);
      const results = await collection.find({}).toArray();

      expect(results).toHaveLength(2);
    });

    it('#find {_id:"echo"} should return correct document', async () => {
      await collection.insert({ _id: "echo" });
      await collection.insert({ _id: "sierra" });

      const results = await collection.find({ _id: "echo" }).toArray();

      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe("echo");
    });

    it('#find with complex key {"name.first":"echo"} should return correct document', async () => {
      await collection.insert({ _id: "echo", name: { first: "ECHO", last: "TV" } });
      await collection.insert({ _id: "sierra", name: { first: "SIERRA", last: "TV" } });

      const results = await collection.find({ "name.first": "ECHO" }).toArray();

      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe("echo");
    });

    it("#find with project should return correct projection", async () => {
      await collection.insert({ _id: "echo", name: { first: "ECHO", last: "TV" } });
      await collection.insert({ _id: "sierra", name: { first: "SIERRA", last: "TV" } });

      const results = await collection.find({}).project({ _id: 1 }).toArray();

      expect(results[0].name).toBeUndefined();
      expect(results[0]._id).toBe("echo");
    });

    it("#drop should remove all documents", async () => {
      await collection.insert({ _id: "echo" });
      await collection.drop();

      const results = await collection.find({}).toArray();
      expect(results).toHaveLength(0);
    });

    it("#createIndex should create index successfully", async () => {
      await collection.createIndex({ name: 1 });
      const indexes = await collection._collection.listIndexes().toArray();
      expect(indexes).toContainEqual({ v: 2, key: { name: 1 }, name: "name_1" });
    });

    it("#remove should remove one document", async () => {
      await collection.insert({ _id: "echo", name: { first: "ECHO", last: "TV" } });
      await collection.insert({ _id: "sierra", name: { first: "SIERRA", last: "TV" } });
      await collection.remove({ _id: "echo" });
      const results = await collection.find({ "name.first": "ECHO" }).toArray();
      expect(results).toHaveLength(0);
    });

    const populate = async (collection: MongoDBCollection, id: number) => {
      await collection.insert({ a: "a", id: String(id) });
      if (id === 9) {
        return;
      }
      return populate(collection, ++id);
    };

    it("#skip/limit", async () => {
      await populate(collection, 0);
      const res = await collection.find({ a: "a" }).skip(8).limit(10).toArray();
      expect(res[1].id).toBe("9");
      expect(res).toHaveLength(2); // only 2 left after skipping 8/10
    });

    it("#count", async () => {
      await populate(collection, 0);
      const res = await collection.find({}).count();
      expect(res).toBe(10);
    });

    it("#count should apply skip", async () => {
      await populate(collection, 0);
      const res = await collection.find({}).skip(8).count();
      expect(res).toBe(2);
    });
  });
});

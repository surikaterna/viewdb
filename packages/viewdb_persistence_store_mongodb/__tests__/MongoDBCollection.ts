import { MongoClient, ReadPreference } from "mongodb";
import MongoDBStore from "../src/MongoDBStore";

const Store = MongoDBStore;

describe("mongodb_persistence", () => {
  const COLLECTION_NAME = "collection";
  let _mongoClient;
  let _db;

  const getDb = () => _db;

  beforeAll(async () => {
    const mongoClient = await MongoClient.connect(global.__MONGO_URI__);
    const db = await mongoClient.db("db_test_suite_collection");

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

  describe("Collection", () => {
    it("#find with empty array should return 0 docs", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store
            .collection(COLLECTION_NAME)
            .find({})
            .toArray((_err, results) => {
              expect(results).toHaveLength(0);
              resolve();
            });
        });
      }));
    it("#find with setReadPreference", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          const cursor = store.collection(COLLECTION_NAME).find({});
          cursor.setReadPreference(ReadPreference.PRIMARY);
          cursor.toArray((_err, results) => {
            expect(results).toHaveLength(0);
            resolve();
          });
        });
      }));
    it("#insert two documents with same key should throw", () =>
      new Promise<void>((resolve, reject) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store.collection(COLLECTION_NAME).insert({ _id: "echo" }, () => {
            store.collection(COLLECTION_NAME).insert({ _id: "echo" }, (err) => {
              if (err) {
                resolve();
              } else {
                reject(new Error("should have thrown unique constraint"));
              }
            });
          });
        });
      }));
    it("#update documents already existing", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store.collection(COLLECTION_NAME).insert({ _id: "existing" }, () => {
            store.collection(COLLECTION_NAME).save({ _id: "existing", version: 2 }, () => {
              store
                .collection(COLLECTION_NAME)
                .find({})
                .toArray((_err, results) => {
                  expect(results).toHaveLength(1);
                  expect(results[0].version).toBe(2);
                  resolve();
                });
            });
          });
        });
      }));
    it("#update one document", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store.collection(COLLECTION_NAME).insert({ _id: "existing" }, () => {
            store
              .collection(COLLECTION_NAME)
              .updateOne({ _id: "existing" }, { $set: { _id: "existing", name: "john" } }, () => {
                store
                  .collection(COLLECTION_NAME)
                  .find({})
                  .toArray((_err, results) => {
                    expect(results).toHaveLength(1);
                    expect(results[0].name).toBe("john");
                    resolve();
                  });
              });
          });
        });
      }));

    it("#findAndModify upsert", async () => {
      const store = new Store(getDb());
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
      await store.open();
      await store.collection(COLLECTION_NAME).findAndModify(filter, sort, update, options);
      const results = await store.collection(COLLECTION_NAME).find({}).toArray();
      expect(results).toHaveLength(1);
      expect(results[0]).toStrictEqual({
        _id: "not-existing",
        events: [{ event: 1, test: 2 }],
        references: [{ ref: 1 }, { ref: 2 }, { ref: 3 }],
        test: 1,
      });
    });

    it("#findAndModify modify", async () => {
      const store = new Store(getDb());
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
      await store.open();
      await store
        .collection(COLLECTION_NAME)
        .save({ _id: "not-existing", test: 2, events: [{ event: 10, test: 3 }], references: [] });
      await store.collection(COLLECTION_NAME).findAndModify(filter, sort, update, options);
      const results = await store.collection(COLLECTION_NAME).find({}).toArray();
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

    it("#update many documents", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store.collection(COLLECTION_NAME).insert(
            [
              { _id: "existing1", name: "john" },
              { _id: "existing2", name: "john" },
            ],
            () => {
              store.collection(COLLECTION_NAME).updateMany({ name: "john" }, { $set: { lastName: "connor" } }, () => {
                store
                  .collection(COLLECTION_NAME)
                  .find({})
                  .toArray((_err, results) => {
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
                    resolve();
                  });
              });
            }
          );
        });
      }));
    it("#find {} should return single inserted document", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store.collection(COLLECTION_NAME).insert({ _id: "echo" }, () => {
            store
              .collection(COLLECTION_NAME)
              .find({})
              .toArray((_err, results) => {
                expect(results).toHaveLength(1);
                resolve();
              });
          });
        });
      }));
    it("#find {} should return multiple inserted documents", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          // store.collection(COLLECTION_NAME).insert([{ _id: 'echo' }, { _id: 'sierra' }]);

          store.collection(COLLECTION_NAME).insert([{ _id: "echo" }, { _id: "sierra" }], () => {
            store
              .collection(COLLECTION_NAME)
              .find({})
              .toArray((_err, results) => {
                expect(results).toHaveLength(2);
                resolve();
              });
          });
        });
      }));
    it('#find {_id:"echo"} should return correct document', () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store.collection(COLLECTION_NAME).insert({ _id: "echo" }, () => {
            store.collection(COLLECTION_NAME).insert({ _id: "sierra" }, () => {
              store
                .collection(COLLECTION_NAME)
                .find({ _id: "echo" })
                .toArray((_err, results) => {
                  expect(results).toHaveLength(1);
                  expect(results[0]._id).toBe("echo");
                  resolve();
                });
            });
          });
        });
      }));
    it('#find with complex key {"name.first":"echo"} should return correct document', () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store.collection(COLLECTION_NAME).insert({ _id: "echo", name: { first: "ECHO", last: "TV" } }, () => {
            store.collection(COLLECTION_NAME).insert({ _id: "sierra", name: { first: "SIERRA", last: "TV" } }, () => {
              store
                .collection(COLLECTION_NAME)
                .find({ "name.first": "ECHO" })
                .toArray((_err, results) => {
                  expect(results).toHaveLength(1);
                  expect(results[0]._id).toBe("echo");
                  resolve();
                });
            });
          });
        });
      }));
    it("#find with project should return correct projection", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store.collection(COLLECTION_NAME).insert({ _id: "echo", name: { first: "ECHO", last: "TV" } }, () => {
            store.collection(COLLECTION_NAME).insert({ _id: "sierra", name: { first: "SIERRA", last: "TV" } }, () => {
              store
                .collection(COLLECTION_NAME)
                .find({})
                .project({ _id: 1 })
                .toArray((_err, results) => {
                  expect(results[0].name).toBeUndefined();
                  expect(results[0]._id).toBe("echo");
                  resolve();
                });
            });
          });
        });
      }));
    it("#drop should remove all documents", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store.collection(COLLECTION_NAME).insert({ _id: "echo" }, () => {
            store.collection(COLLECTION_NAME).drop(() => {
              store
                .collection(COLLECTION_NAME)
                .find({})
                .toArray((_err, results) => {
                  expect(results).toHaveLength(0);
                  resolve();
                });
            });
          });
        });
      }));
    it("#createIndex should create index successfully", async () => {
      const store = new Store(getDb());
      await store.open();

      const collection = await store.collection(COLLECTION_NAME);
      await collection.createIndex({ name: 1 });

      const indexes = await collection._collection.listIndexes().toArray();

      expect(indexes).toContainEqual({ v: 2, key: { name: 1 }, name: "name_1" });
    });

    it("#remove should remove one document", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        store.open().then(() => {
          store.collection(COLLECTION_NAME).insert({ _id: "echo", name: { first: "ECHO", last: "TV" } }, () => {
            store.collection(COLLECTION_NAME).insert({ _id: "sierra", name: { first: "SIERRA", last: "TV" } }, () => {
              store.collection(COLLECTION_NAME).remove({ _id: "echo" }, null, () => {
                store
                  .collection(COLLECTION_NAME)
                  .find({ "name.first": "ECHO" })
                  .toArray((_err, results) => {
                    expect(results).toHaveLength(0);
                    resolve();
                  });
              });
            });
          });
        });
      }));
    const populate = (collection, id, cb) => {
      collection.insert({ a: "a", id: id }, () => {
        if (id === 9) {
          cb();
        } else {
          populate(collection, ++id, cb);
        }
      });
    };
    it("#skip/limit", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        const collection = store.collection(COLLECTION_NAME);
        populate(collection, 0, () => {
          collection
            .find({ a: "a" })
            .skip(8)
            .limit(10)
            .toArray((_err, res) => {
              expect(res[1].id).toBe(9);
              expect(res).toHaveLength(2); // only 2 left after skipping 8/10
              resolve();
            });
        });
      }));
    it("#count", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        const collection = store.collection(COLLECTION_NAME);
        populate(collection, 0, () => {
          collection.find({}).count((_err, res) => {
            expect(res).toBe(10);
            resolve();
          });
        });
      }));
    it("#count should apply skip", () =>
      new Promise<void>((resolve) => {
        const store = new Store(getDb());
        const collection = store.collection(COLLECTION_NAME);
        populate(collection, 0, () => {
          collection
            .find({})
            .skip(8)
            .count((_err, res) => {
              expect(res).toBe(2);
              resolve();
            });
        });
      }));
  });
});

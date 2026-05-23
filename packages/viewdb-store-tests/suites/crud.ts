import assert from "assert";

export default function (config) {
  const COLL = "test_shared";

  describe("crud", () => {
    let store;

    beforeAll(async () => {
      await config.initialize?.();
    });

    beforeEach(async () => {
      store = await config.createStore();
    });

    afterEach(async () => {
      await config.destroyStore(store);
    });

    afterAll(async () => {
      await config.cleanup?.();
    });

    describe("#create", () => {
      describe("#insert", () => {
        it("insert bulk inserts multiple documents", async () => {
          await store.collection(COLL).insert([{ _id: "echo" }, { _id: "sierra" }]);
          const results = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(results.length, 2);
        });
      });
    });

    describe("#read", () => {
      describe("#find", () => {
        it("find on empty collection returns 0 docs", async () => {
          const results = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(results.length, 0);
        });

        it("find returns single inserted document", async () => {
          await store.collection(COLL).insert({ _id: "echo" });
          const results = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(results.length, 1);
        });

        it("find returns multiple inserted documents", async () => {
          await store.collection(COLL).insert({ _id: "echo" });
          await store.collection(COLL).insert({ _id: "sierra" });
          const results = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(results.length, 2);
        });
      });
    });

    describe("#update", () => {
      describe("#save", () => {
        it("save updates an existing document", async () => {
          await store.collection(COLL).insert({ _id: "echo" });
          await store.collection(COLL).save({ _id: "echo", version: 2 });
          const results = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(results.length, 1);
          assert.strictEqual(results[0].version, 2);
        });
      });
    });

    describe("#delete", () => {
      describe("#deleteMany", () => {
        beforeEach(async () => {
          await store.collection(COLL).insert([
            { _id: "alpha", version: 1 },
            { _id: "bravo", version: 2 },
            { _id: "charlie", version: 2 },
            { _id: "delta", version: 1 },
          ]);
        });

        it("should delete multiple documents matching query", async () => {
          const result = await store.collection(COLL).deleteMany({ version: 1 });
          assert.strictEqual(result.acknowledged, true);
          assert.strictEqual(result.deletedCount, 2);

          const docs = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(docs.length, 2);
          assert.strictEqual(docs[0]._id, "bravo");
          assert.strictEqual(docs[1]._id, "charlie");
        });

        it("should delete all documents on empty query", async () => {
          const result = await store.collection(COLL).deleteMany({});
          assert.strictEqual(result.acknowledged, true);
          assert.strictEqual(result.deletedCount, 4);

          const docs = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(docs.length, 0);
        });

        it("should delete all documents when no query is provided", async () => {
          const result = await store.collection(COLL).deleteMany();
          assert.strictEqual(result.acknowledged, true);
          assert.strictEqual(result.deletedCount, 4);

          const docs = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(docs.length, 0);
        });
      });

      describe("#deleteOne", () => {
        beforeEach(async () => {
          await store.collection(COLL).insert([
            { _id: "alpha", version: 1 },
            { _id: "bravo", version: 2 },
            { _id: "charlie", version: 2 },
            { _id: "delta", version: 1 },
          ]);
        });

        it("should delete the first document matching the query", async () => {
          const result = await store.collection(COLL).deleteOne({ _id: "charlie" });
          assert.strictEqual(result.acknowledged, true);
          assert.strictEqual(result.deletedCount, 1);

          const docs = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(docs.length, 3);
          assert.strictEqual(docs[0]._id, "alpha");
          assert.strictEqual(docs[1]._id, "bravo");
          assert.strictEqual(docs[2]._id, "delta");
        });

        it("should delete the first document when no query is provided", async () => {
          const result = await store.collection(COLL).deleteOne();
          assert.strictEqual(result.acknowledged, true);
          assert.strictEqual(result.deletedCount, 1);

          const docs = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(docs.length, 3);
          assert.strictEqual(docs[0]._id, "bravo");
          assert.strictEqual(docs[1]._id, "charlie");
          assert.strictEqual(docs[2]._id, "delta");
        });
      });

      describe("#remove ()", () => {
        it("remove deletes a document", async () => {
          await store.collection(COLL).insert({ _id: "echo" });
          await store.collection(COLL).remove({ _id: "echo" }, null);
          const results = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(results.length, 0);
        });
      });

      describe("#drop", () => {
        it("drop removes all documents", async () => {
          await store.collection(COLL).insert({ _id: "echo" });
          await store.collection(COLL).drop();
          const results = await store.collection(COLL).find({}).toArray();
          assert.strictEqual(results.length, 0);
        });
      });
    });
  });
}

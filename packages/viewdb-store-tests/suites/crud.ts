import assert from "assert";

export default function (config) {
  const COLL = "test_shared";

  describe("crud", function () {
    let store;

    beforeEach(async function () {
      store = await config.createStore();
    });

    afterEach(async function () {
      await config.destroyStore(store);
    });

    it("find on empty collection returns 0 docs", async function () {
      const results = await store.collection(COLL).find({}).toArray();
      assert.strictEqual(results.length, 0);
    });

    it("find returns single inserted document", async function () {
      await store.collection(COLL).insert({ _id: "echo" });
      const results = await store.collection(COLL).find({}).toArray();
      assert.strictEqual(results.length, 1);
    });

    it("find returns multiple inserted documents", async function () {
      await store.collection(COLL).insert({ _id: "echo" });
      await store.collection(COLL).insert({ _id: "sierra" });
      const results = await store.collection(COLL).find({}).toArray();
      assert.strictEqual(results.length, 2);
    });

    it("insert bulk inserts multiple documents", async function () {
      await store.collection(COLL).insert([{ _id: "echo" }, { _id: "sierra" }]);
      const results = await store.collection(COLL).find({}).toArray();
      assert.strictEqual(results.length, 2);
    });

    it("save updates an existing document", async function () {
      await store.collection(COLL).insert({ _id: "echo" });
      await store.collection(COLL).save({ _id: "echo", version: 2 });
      const results = await store.collection(COLL).find({}).toArray();
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].version, 2);
    });

    it("remove deletes a document", async function () {
      await store.collection(COLL).insert({ _id: "echo" });
      await store.collection(COLL).remove({ _id: "echo" }, null);
      const results = await store.collection(COLL).find({}).toArray();
      assert.strictEqual(results.length, 0);
    });

    it("drop removes all documents", async function () {
      await store.collection(COLL).insert({ _id: "echo" });
      await store.collection(COLL).drop();
      const results = await store.collection(COLL).find({}).toArray();
      assert.strictEqual(results.length, 0);
    });
  });
}

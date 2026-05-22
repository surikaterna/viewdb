import assert from "assert";

export default function (config) {
  const COLL = "test_shared";

  describe("query", () => {
    let store;

    beforeEach(async () => {
      store = await config.createStore();
    });

    afterEach(async () => {
      await config.destroyStore(store);
    });

    it("find by _id returns correct document", async () => {
      await store.collection(COLL).insert({ _id: "echo" });
      await store.collection(COLL).insert({ _id: "sierra" });
      const results = await store.collection(COLL).find({ _id: "echo" }).toArray();
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]._id, "echo");
    });

    it("find by nested key returns correct document", async () => {
      const doc1 = { _id: "echo", name: { first: "ECHO", last: "TV" } };
      const doc2 = { _id: "sierra", name: { first: "SIERRA", last: "TV" } };
      await store.collection(COLL).insert(doc1);
      await store.collection(COLL).insert(doc2);
      const results = await store.collection(COLL).find({ "name.first": "ECHO" }).toArray();
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]._id, "echo");
    });

    it("find with $in returns matching documents", async () => {
      await store.collection(COLL).insert({ _id: "echo" });
      await store.collection(COLL).insert({ _id: "sierra" });
      const results = await store
        .collection(COLL)
        .find({ _id: { $in: ["echo", "sierra"] } })
        .toArray();
      assert.strictEqual(results.length, 2);
    });
  });
}

import assert from "assert";

export default function (config) {
  const COLL = "test_shared";

  describe("count", function () {
    let store;

    beforeEach(async function () {
      store = await config.createStore();
    });

    afterEach(async function () {
      await config.destroyStore(store);
    });

    it("count all returns total number of documents", async function () {
      await store.collection(COLL).insert({ _id: "echo" });
      await store.collection(COLL).insert({ _id: "sierra" });
      const count = await store.collection(COLL).find({}).count();
      assert.strictEqual(count, 2);
    });

    it("count with filter returns filtered count", async function () {
      await store.collection(COLL).insert({ _id: "echo" });
      await store.collection(COLL).insert({ _id: "sierra" });
      const count = await store.collection(COLL).find({ _id: "echo" }).count();
      assert.strictEqual(count, 1);
    });

    it("count with skip returns reduced count", async function () {
      await store.collection(COLL).insert({ _id: "echo" });
      await store.collection(COLL).insert({ _id: "sierra" });
      const count = await store.collection(COLL).find({}).skip(1).count();
      assert.strictEqual(count, 1);
    });
  });
}

import assert from "assert";

export default function (config) {
  const COLL = "test_shared";

  describe("cursor", function () {
    let store;

    beforeEach(async function () {
      store = await config.createStore();
    });

    afterEach(async function () {
      await config.destroyStore(store);
    });

    async function insertFour() {
      const col = store.collection(COLL);
      await col.insert({ _id: "alpha" });
      await col.insert({ _id: "beta" });
      await col.insert({ _id: "cosworth" });
      await col.insert({ _id: "dingo" });
    }

    it("sort ascending returns first element correctly", async function () {
      await insertFour();
      const results = await store.collection(COLL).find({}).sort({ _id: 1 }).toArray();
      assert.strictEqual(results[0]._id, "alpha");
    });

    it("sort descending returns first element correctly", async function () {
      await insertFour();
      const results = await store.collection(COLL).find({}).sort({ _id: -1 }).toArray();
      assert.strictEqual(results[0]._id, "dingo");
    });

    it("skip and limit return correct subset", async function () {
      await insertFour();
      const results = await store.collection(COLL).find({}).sort({ _id: 1 }).skip(1).limit(2).toArray();
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0]._id, "beta");
      assert.strictEqual(results[1]._id, "cosworth");
    });
  });
}

import assert from "assert";

export default function (config) {
  const COLL = "test_shared";

  describe("count", () => {
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

    describe("#count (deprecated)", () => {
      it("count all returns total number of documents", async () => {
        await store.collection(COLL).insert({ _id: "echo" });
        await store.collection(COLL).insert({ _id: "sierra" });
        const count = await store.collection(COLL).find({}).count();
        assert.strictEqual(count, 2);
      });

      it("count with filter returns filtered count", async () => {
        await store.collection(COLL).insert({ _id: "echo" });
        await store.collection(COLL).insert({ _id: "sierra" });
        const count = await store.collection(COLL).find({ _id: "echo" }).count();
        assert.strictEqual(count, 1);
      });

      it("count with skip returns reduced count", async () => {
        await store.collection(COLL).insert({ _id: "echo" });
        await store.collection(COLL).insert({ _id: "sierra" });
        const count = await store.collection(COLL).find({}).skip(1).count();
        assert.strictEqual(count, 1);
      });
    });

    describe("#countDocuments", () => {
      it("count all returns total number of documents", async () => {
        await store.collection(COLL).insert({ _id: "echo" });
        await store.collection(COLL).insert({ _id: "sierra" });
        const count = await store.collection(COLL).countDocuments({});
        assert.strictEqual(count, 2);
      });

      it("count with filter returns filtered count", async () => {
        await store.collection(COLL).insert({ _id: "echo" });
        await store.collection(COLL).insert({ _id: "sierra" });
        const count = await store.collection(COLL).countDocuments({ _id: "echo" });
        assert.strictEqual(count, 1);
      });

      it("count with skip returns reduced count", async () => {
        await store.collection(COLL).insert({ _id: "echo" });
        await store.collection(COLL).insert({ _id: "sierra" });
        const count = await store.collection(COLL).countDocuments({}, { skip: 1 });
        assert.strictEqual(count, 1);
      });
    });

    describe("#estimatedDocumentCount", () => {
      it("count all returns total number of documents", async () => {
        await store.collection(COLL).insert({ _id: "echo" });
        await store.collection(COLL).insert({ _id: "sierra" });
        const count = await store.collection(COLL).estimatedDocumentCount();
        assert.strictEqual(count, 2);
      });
    });
  });
}

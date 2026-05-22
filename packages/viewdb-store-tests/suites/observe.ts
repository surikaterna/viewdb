import assert from "assert";

function after(n, fn) {
  let count = 0;
  return function () {
    if (++count >= n) {
      fn.apply(this, arguments);
    }
  };
}

export default function (config) {
  const COLL = "test_shared";
  const delay = config.observeOptions.settleDelay;

  describe("observe", () => {
    let store;

    beforeEach(async () => {
      store = await config.createStore();
    });

    afterEach(async () => {
      await config.destroyStore(store);
    });

    it("init fires with empty collection", () =>
      new Promise<void>((resolve) => {
        const cursor = store.collection(COLL).find({});
        const handle = cursor.observe({
          init: (coll) => {
            assert.strictEqual(coll.length, 0);
            setTimeout(() => {
              handle.stop();
              resolve();
            }, delay);
          },
        });
      }));

    it("added fires on insert", () =>
      new Promise<void>((resolve) => {
        const cursor = store.collection(COLL).find({});
        const handle = cursor.observe({
          added: (x) => {
            assert.strictEqual(x._id, "echo");
            setTimeout(() => {
              handle.stop();
              resolve();
            }, delay);
          },
        });
        store.collection(COLL).insert({ _id: "echo" });
      }));

    it("removed fires on remove", async () => {
      await store.collection(COLL).insert({ _id: "echo" });
      await new Promise<void>((resolve) => {
        const cursor = store.collection(COLL).find({});
        const handle = cursor.observe({
          removed: (x) => {
            assert.strictEqual(x._id, "echo");
            handle.stop();
            resolve();
          },
        });
        store.collection(COLL).remove({ _id: "echo" });
      });
    });

    it("added fires for matching query on insert", async () => {
      await store.collection(COLL).insert({ _id: "echo" });
      await new Promise<void>((resolve) => {
        const cursor = store.collection(COLL).find({ _id: "echo2" });
        const handle = cursor.observe({
          added: (x) => {
            assert.strictEqual(x._id, "echo2");
            setTimeout(() => {
              handle.stop();
              resolve();
            }, delay);
          },
        });
        store.collection(COLL).insert({ _id: "echo2" });
      });
    });

    it("changed fires on update", () =>
      new Promise<void>((resolve) => {
        const cursor = store.collection(COLL).find({ _id: "echo" });
        const handle = cursor.observe({
          added: (x) => {
            assert.strictEqual(x.age, 10);
          },
          changed: (o, n) => {
            assert.strictEqual(o.age, 10);
            assert.strictEqual(n.age, 100);
            handle.stop();
            resolve();
          },
        });
        store
          .collection(COLL)
          .insert({ _id: "echo", age: 10 })
          .then(() => {
            store.collection(COLL).save({ _id: "echo", age: 100 });
          });
      }));

    it("observe with skip updates correctly", async () => {
      await store.collection(COLL).insert({ _id: "echo" });
      await store.collection(COLL).insert({ _id: "echo2" });
      await store.collection(COLL).insert({ _id: "echo3" });

      await new Promise<void>((resolve) => {
        const cursor = store.collection(COLL).find({});
        let skip = 0;
        cursor.limit(1);
        const realDone = after(3, () => {
          cursor.toArray().then((res) => {
            assert.strictEqual(res.length, 0);
            setTimeout(() => {
              handle.stop();
              resolve();
            }, delay);
          });
        });
        const handle = cursor.observe({
          added: () => {
            cursor.skip(++skip);
            realDone();
          },
        });
      });
    });
  });
}

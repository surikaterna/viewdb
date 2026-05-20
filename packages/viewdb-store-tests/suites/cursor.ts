import assert from "assert";

export default function (config) {
  const COLL = "test_shared";

  describe("cursor", function () {
    let store;

    beforeEach(function () {
      return new Promise<void>(function (resolve) {
        config.createStore(function (s) {
          store = s;
          resolve();
        });
      });
    });

    afterEach(function () {
      return new Promise<void>(function (resolve) {
        config.destroyStore(store, resolve);
      });
    });

    function insertFour(cb) {
      const col = store.collection(COLL);
      col.insert({ _id: "alpha" }, function () {
        col.insert({ _id: "beta" }, function () {
          col.insert({ _id: "cosworth" }, function () {
            col.insert({ _id: "dingo" }, cb);
          });
        });
      });
    }

    it("sort ascending returns first element correctly", function () {
      return new Promise<void>(function (resolve, reject) {
        insertFour(function () {
          store
            .collection(COLL)
            .find({})
            .sort({ _id: 1 })
            .toArray(function (err, results) {
              if (err) return reject(err);
              assert.strictEqual(results[0]._id, "alpha");
              resolve();
            });
        });
      });
    });

    it("sort descending returns first element correctly", function () {
      return new Promise<void>(function (resolve, reject) {
        insertFour(function () {
          store
            .collection(COLL)
            .find({})
            .sort({ _id: -1 })
            .toArray(function (err, results) {
              if (err) return reject(err);
              assert.strictEqual(results[0]._id, "dingo");
              resolve();
            });
        });
      });
    });

    it("skip and limit return correct subset", function () {
      return new Promise<void>(function (resolve, reject) {
        insertFour(function () {
          store
            .collection(COLL)
            .find({})
            .sort({ _id: 1 })
            .skip(1)
            .limit(2)
            .toArray(function (err, results) {
              if (err) return reject(err);
              assert.strictEqual(results.length, 2);
              assert.strictEqual(results[0]._id, "beta");
              assert.strictEqual(results[1]._id, "cosworth");
              resolve();
            });
        });
      });
    });
  });
}

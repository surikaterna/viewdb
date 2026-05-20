import assert from "assert";

export default function (config) {
  var COLL = "test_shared";

  describe("query", function () {
    var store;

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

    it("find by _id returns correct document", function () {
      return new Promise<void>(function (resolve, reject) {
        store.collection(COLL).insert({ _id: "echo" }, function () {
          store.collection(COLL).insert({ _id: "sierra" }, function () {
            store
              .collection(COLL)
              .find({ _id: "echo" })
              .toArray(function (err, results) {
                if (err) return reject(err);
                assert.strictEqual(results.length, 1);
                assert.strictEqual(results[0]._id, "echo");
                resolve();
              });
          });
        });
      });
    });

    it("find by nested key returns correct document", function () {
      return new Promise<void>(function (resolve, reject) {
        var doc1 = { _id: "echo", name: { first: "ECHO", last: "TV" } };
        var doc2 = { _id: "sierra", name: { first: "SIERRA", last: "TV" } };
        store.collection(COLL).insert(doc1, function () {
          store.collection(COLL).insert(doc2, function () {
            store
              .collection(COLL)
              .find({ "name.first": "ECHO" })
              .toArray(function (err, results) {
                if (err) return reject(err);
                assert.strictEqual(results.length, 1);
                assert.strictEqual(results[0]._id, "echo");
                resolve();
              });
          });
        });
      });
    });

    it("find with $in returns matching documents", function () {
      return new Promise<void>(function (resolve, reject) {
        store.collection(COLL).insert({ _id: "echo" }, function () {
          store.collection(COLL).insert({ _id: "sierra" }, function () {
            store
              .collection(COLL)
              .find({ _id: { $in: ["echo", "sierra"] } })
              .toArray(function (err, results) {
                if (err) return reject(err);
                assert.strictEqual(results.length, 2);
                resolve();
              });
          });
        });
      });
    });
  });
}

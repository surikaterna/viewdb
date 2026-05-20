import assert from 'assert';

export default function (config) {
  var COLL = 'test_shared';

  describe('count', function () {
    var store;

    beforeEach(function () {
      return new Promise(function (resolve) {
        config.createStore(function (s) {
          store = s;
          resolve();
        });
      });
    });

    afterEach(function () {
      return new Promise(function (resolve) {
        config.destroyStore(store, resolve);
      });
    });

    it('count all returns total number of documents', function () {
      return new Promise(function (resolve, reject) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          store.collection(COLL).insert({ _id: 'sierra' }, function () {
            store
              .collection(COLL)
              .find({})
              .count(function (err, count) {
                if (err) return reject(err);
                assert.strictEqual(count, 2);
                resolve();
              });
          });
        });
      });
    });

    it('count with filter returns filtered count', function () {
      return new Promise(function (resolve, reject) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          store.collection(COLL).insert({ _id: 'sierra' }, function () {
            store
              .collection(COLL)
              .find({ _id: 'echo' })
              .count(function (err, count) {
                if (err) return reject(err);
                assert.strictEqual(count, 1);
                resolve();
              });
          });
        });
      });
    });

    it('count with skip returns reduced count', function () {
      return new Promise(function (resolve, reject) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          store.collection(COLL).insert({ _id: 'sierra' }, function () {
            store
              .collection(COLL)
              .find({})
              .skip(1)
              .count(function (err, count) {
                if (err) return reject(err);
                assert.strictEqual(count, 1);
                resolve();
              });
          });
        });
      });
    });
  });
};

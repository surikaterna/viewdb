import assert from 'assert';

export default function (config) {
  var COLL = 'test_shared';

  describe('crud', function () {
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

    it('find on empty collection returns 0 docs', function () {
      return new Promise(function (resolve, reject) {
        store
          .collection(COLL)
          .find({})
          .toArray(function (err, results) {
            if (err) return reject(err);
            assert.strictEqual(results.length, 0);
            resolve();
          });
      });
    });

    it('find returns single inserted document', function () {
      return new Promise(function (resolve, reject) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          store
            .collection(COLL)
            .find({})
            .toArray(function (err, results) {
              if (err) return reject(err);
              assert.strictEqual(results.length, 1);
              resolve();
            });
        });
      });
    });

    it('find returns multiple inserted documents', function () {
      return new Promise(function (resolve, reject) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          store.collection(COLL).insert({ _id: 'sierra' }, function () {
            store
              .collection(COLL)
              .find({})
              .toArray(function (err, results) {
                if (err) return reject(err);
                assert.strictEqual(results.length, 2);
                resolve();
              });
          });
        });
      });
    });

    it('insert bulk inserts multiple documents', function () {
      return new Promise(function (resolve, reject) {
        store.collection(COLL).insert([{ _id: 'echo' }, { _id: 'sierra' }], function () {
          store
            .collection(COLL)
            .find({})
            .toArray(function (err, results) {
              if (err) return reject(err);
              assert.strictEqual(results.length, 2);
              resolve();
            });
        });
      });
    });

    it('save updates an existing document', function () {
      return new Promise(function (resolve, reject) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          store.collection(COLL).save({ _id: 'echo', version: 2 }, function () {
            store
              .collection(COLL)
              .find({})
              .toArray(function (err, results) {
                if (err) return reject(err);
                assert.strictEqual(results.length, 1);
                assert.strictEqual(results[0].version, 2);
                resolve();
              });
          });
        });
      });
    });

    it('remove deletes a document', function () {
      return new Promise(function (resolve, reject) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          store.collection(COLL).remove({ _id: 'echo' }, null, function () {
            store
              .collection(COLL)
              .find({})
              .toArray(function (err, results) {
                if (err) return reject(err);
                assert.strictEqual(results.length, 0);
                resolve();
              });
          });
        });
      });
    });

    it('drop removes all documents', function () {
      return new Promise(function (resolve, reject) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          store.collection(COLL).drop(function () {
            store
              .collection(COLL)
              .find({})
              .toArray(function (err, results) {
                if (err) return reject(err);
                assert.strictEqual(results.length, 0);
                resolve();
              });
          });
        });
      });
    });
  });
};

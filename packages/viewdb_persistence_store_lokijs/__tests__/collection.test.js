const _ = require('lodash');
const { Store } = require('..');

describe('Collection', function () {
  var store;
  beforeEach(
    () =>
      new Promise((resolve) => {
        store = new Store('test-suite', { inMemoryOnly: true });
        resolve();
      }),
  );
  afterEach(
    () =>
      new Promise((resolve) => {
        if (store) {
          store.collection('dollhouse').drop(function () {
            store.collection('dollhouse2').drop(function () {
              store.close(function () {
                store.clearAllIntervals();
                resolve();
              });
            });
          });
        }
      }),
  );
  it('#find with empty array should return 0 docs', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            expect(results.length).toBe(0);
            resolve();
          });
      });
    }));
  it('#insert two documents with same key but in different collections should work', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store
          .collection('dollhouse2')
          .insert({ _id: 'echo' }, function (err, result) {
            if (err) {
              reject(new Error('should not have thrown unique constraint'));
            } else {
              resolve();
            }
          });
      });
    }));
  it('#update documents already existing', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').save({ _id: 'echo', version: 2 });
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            expect(results.length).toBe(1);
            expect(results[0].version).toBe(2);
            resolve();
          });
      });
    }));
  it('#find {} should return single inserted document', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            expect(results.length).toBe(1);
            resolve();
          });
      });
    }));
  it('#find {} should return multiple inserted documents', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            expect(results.length).toBe(2);
            resolve();
          });
      });
    }));
  it('#find {_id:"echo"} should return correct document', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({ _id: 'echo' })
          .toArray(function (err, results) {
            expect(results.length).toBe(1);
            expect(results[0]._id).toBe('echo');
            resolve();
          });
      });
    }));
  it('#find with complex key {"name.first":"echo"} should return correct document', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        var promises = [
          store
            .collection('dollhouse')
            .insert({ _id: 'echo', name: { first: 'ECHO', last: 'TV' } }),
          store
            .collection('dollhouse')
            .insert({ _id: 'sierra', name: { first: 'SIERRA', last: 'TV' } }),
        ];
        Promise.all(promises)
          .then(function () {
            return store
              .collection('dollhouse')
              .find({ 'name.first': 'ECHO' })
              .toArray(function (err, results) {
                expect(results.length).toBe(1);
                expect(results[0]._id).toBe('echo');
                resolve();
              });
          })
          .catch(function (err) {
            reject(err);
          });
      });
    }));
  it('#drop should remove all documents', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').drop();
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            expect(results.length).toBe(0);
            resolve();
          });
      });
    }));
  it('#sort should sort on a property', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'alpha' });
        store.collection('dollhouse').insert({ _id: 'beta' });
        store.collection('dollhouse').insert({ _id: 'cosworth' });
        store.collection('dollhouse').insert({ _id: 'dingo' });

        store
          .collection('dollhouse')
          .find({})
          .sort({ _id: 1 })
          .toArray(function (err, results) {
            expect(results[0]._id).toBe('alpha');
            resolve();
          });
      });
    }));
  it('#sort should sort on a property, descending', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'alpha' });
        store.collection('dollhouse').insert({ _id: 'beta' });
        store.collection('dollhouse').insert({ _id: 'cosworth' });
        store.collection('dollhouse').insert({ _id: 'dingo' });

        store
          .collection('dollhouse')
          .find({})
          .sort({ _id: -1 })
          .toArray(function (err, results) {
            expect(results[0]._id).toBe('dingo');
            resolve();
          });
      });
    }));
  it('#insert documents via bulk', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store
          .collection('dollhouse')
          .insert([{ _id: 'echo' }, { _id: 'sierra' }]);
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            expect(results.length).toBe(2);
            resolve();
          });
      });
    }));
  it('#update documents via bulk', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store
          .collection('dollhouse')
          .insert([{ _id: 'echo' }, { _id: 'sierra' }], function () {
            store.collection('dollhouse').save([
              { _id: 'echo', version: 2 },
              { _id: 'sierra', version: 22 },
            ]);
            store
              .collection('dollhouse')
              .find({})
              .toArray(function (err, results) {
                resolve();
              });
          });
      });
    }));
  it('#count should return number of documents', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({})
          .count(function (err, count) {
            expect(count).toBe(2);
            resolve();
          });
      });
    }));
  it('#count should return number of documents with filter', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({ _id: 'echo' })
          .count(function (err, count) {
            expect(count).toBe(1);
            resolve();
          });
      });
    }));
  it('#count should include skip', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({})
          .skip(1)
          .count(function (err, count) {
            expect(count).toBe(1);
            resolve();
          });
      });
    }));
  it('#count without skip should return total', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({})
          .count(function (err, count) {
            expect(count).toBe(2);
            resolve();
          });
      });
    }));
  it('#find {_id: $in ["echo"]} should return correct document', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({ _id: { $in: ['echo', 'sierra'] } })
          .toArray(function (err, results) {
            expect(results.length).toBe(2);
            expect(results[0]._id).toBe('echo');
            resolve();
          });
      });
    }));
  it('#should allow to save with $ chars in _syncProfiles', () =>
    new Promise((resolve) => {
      store.open().then(function () {
        store.collection('_syncProfiles').insert({
          id: 'echo',
          query: { $or: ['1', '2'] },
          subQueries: { $or: ['1', '2'] },
        });
        store
          .collection('_syncProfiles')
          .find({ id: 'echo' })
          .toArray(function (err, results) {
            const equal = _.isEqual(['1', '2'], results[0].query['$or']);
            expect(equal).toBe(true);
            resolve();
          });
      });
    }));
});

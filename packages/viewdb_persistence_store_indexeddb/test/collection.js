import should from 'should';

import Store from '../src/store';
import Collection from '../src/collection';
import getDb from './util';

describe('Collection', function () {
  var store;
  beforeEach(
    () =>
      new Promise((resolve, reject) => {
        var idb = getDb();
        store = new Store(idb);
        resolve();
      })
  );
  afterEach(
    () =>
      new Promise((resolve, reject) => {
        if (store) {
          store.close().then(function () {
            // destroy the world by t bruun
            var idb = store._idb;
            idb._databases.clear();
            resolve();
          });
        }
      })
  );
  //store.delete() }).then(function () {
  // console.log('deleted 2');

  it('#find with empty array should return 0 docs', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            results.length.should.equal(0);
            resolve();
          });
      });
    }));
  it('#insert two documents with same key should throw', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'echo' }, function (err, result) {
          if (err) {
            resolve();
          } else {
            reject(new Error('should have thrown unique constraint'));
          }
        });
      });
    }));
  it('#insert two documents with same key but in different collections should work', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse2').insert({ _id: 'echo' }, function (err, result) {
          if (err) {
            console.log(err);
            reject(new Error('should not have thrown unique constraint'));
          } else {
            resolve();
          }
        });
      });
    }));

  it('#update documents already existing', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').save({ _id: 'echo', version: 2 });
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            results.length.should.equal(1);
            results[0].version.should.equal(2);
            resolve();
          });
      });
    }));
  it('#find {} should return single inserted document', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            results.length.should.equal(1);
            resolve();
          });
      });
    }));
  it('#find {} should return multiple inserted documents', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            results.length.should.equal(2);
            resolve();
          });
      });
    }));
  it('#find {_id:"echo"} should return correct document', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({ _id: 'echo' })
          .toArray(function (err, results) {
            results.length.should.equal(1);
            results[0]._id.should.equal('echo');
            resolve();
          });
      });
    }));
  it('#find with complex key {"name.first":"echo"} should return correct document', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        var promises = [
          store.collection('dollhouse').insert({ _id: 'echo', name: { first: 'ECHO', last: 'TV' } }),
          store.collection('dollhouse').insert({ _id: 'sierra', name: { first: 'SIERRA', last: 'TV' } })
        ];
        Promise.all(promises)
          .then(function () {
            return store
              .collection('dollhouse')
              .find({ 'name.first': 'ECHO' })
              .toArray(function (err, results) {
                results.length.should.equal(1);
                results[0]._id.should.equal('echo');
                resolve();
              });
          })
          .catch(function (err) {
            console.log('Got fish', err);
          });
      });
    }));
  it('#drop should remove all documents', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').drop();

        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            results.length.should.equal(0);
            resolve();
          });
      });
    }));
  it('#sort should sort on a property', () =>
    new Promise((resolve, reject) => {
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
            results[0]._id.should.equal('alpha');
            resolve();
          });
      });
    }));
  it('#sort should sort on a property, descending', () =>
    new Promise((resolve, reject) => {
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
            results[0]._id.should.equal('dingo');
            resolve();
          });
      });
    }));
  it('#insert documents via bulk', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert([{ _id: 'echo' }, { _id: 'sierra' }]);
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            results.length.should.equal(2);
            resolve();
          });
      });
    }));
  it('#update documents via bulk', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert([{ _id: 'echo' }, { _id: 'sierra' }]);
        store.collection('dollhouse').save([
          { _id: 'echo', version: 2 },
          { _id: 'sierra', version: 22 }
        ]);
        store
          .collection('dollhouse')
          .find({})
          .toArray(function (err, results) {
            results.length.should.equal(2);
            results[0].version.should.equal(2);
            results[1].version.should.equal(22);
            resolve();
          });
      });
    }));
  it('#count should return number of documents', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({})
          .count(function (err, count) {
            count.should.equal(2);
            resolve();
          });
      });
    }));
  it('#count should return number of documents with filter', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({ _id: 'echo' })
          .count(function (err, count) {
            count.should.equal(1);
            resolve();
          });
      });
    }));
  // viewdb@0.12.0 always applies skip/limit to count() — the applySkipLimit parameter was removed
  it('#count should include skip', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({})
          .skip(1)
          .count(function (err, count) {
            count.should.equal(1);
            resolve();
          });
      });
    }));
  // Removed: '#count should include skip only when explicitly stated'
  // viewdb@0.12.0 always applies skip/limit to count(), matching MongoDB driver behavior.
  // The opt-in applySkipLimit parameter no longer exists, so skip is never ignored.
  it('#find {_id:"echo"} should use primary key index', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse')._isIdentityQuery({ _id: 'echo' }).should.equal(true);
        resolve();
      });
    }));
  it('#find {id:"echo"} should use primary key index', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse')._isIdentityQuery({ id: 'echo' }).should.equal(true);
        resolve();
      });
    }));
  it('#find {xid:"echo"} should not use primary key index', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse')._isIdentityQuery({ xid: 'echo' }).should.equal(false);
        resolve();
      });
    }));
  it('#find {id:"echo", age:12} should not use primary key index', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse')._isIdentityQuery({ id: 'echo', age: 12 }).should.equal(false);
        resolve();
      });
    }));
  it('#find {_id: $in ["echo"]} should return correct document', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store
          .collection('dollhouse')
          .find({ _id: { $in: ['echo', 'sierra'] } })
          .toArray(function (err, results) {
            results.length.should.equal(2);
            results[0]._id.should.equal('echo');
            resolve();
          });
      });
    }));
  it('#_getByKey {id:"echo"} should return value', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store.collection('dollhouse')._getByKey({ query: { _id: 'echo' } }, function (err, res) {
          res.length.should.equal(1);
          res[0]._id.should.equal('echo');
          resolve();
        });
      });
    }));
  it('#_getByKey {id:"echo-no-match"} should return 0 value', () =>
    new Promise((resolve, reject) => {
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'sierra' });
        store.collection('dollhouse')._getByKey({ query: { _id: 'echo-no-match' } }, function (err, res) {
          res.length.should.equal(0);
          resolve();
        });
      });
    }));
});

import { ViewDB as ViewDb } from '..';
import _ from 'lodash';

describe('Observe', () => {
  it('#observe with insert', () =>
    new Promise((resolve, reject) => {
      var store = new ViewDb();
      store.open().then(function () {
        var cursor = store.collection('dollhouse').find({});
        var handle = cursor.observe({
          added: function (x) {
            expect(x._id).toBe('echo');
            handle.stop();
            resolve();
          }
        });
        store.collection('dollhouse').insert({ _id: 'echo' });
      });
    }));
  it('#observe with query and insert', () =>
    new Promise((resolve, reject) => {
      var store = new ViewDb();
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        var cursor = store.collection('dollhouse').find({ _id: 'echo2' });
        cursor.observe({
          added: function (x) {
            expect(x._id).toBe('echo2');
            resolve();
          }
        });
        store.collection('dollhouse').insert({ _id: 'echo2' });
      });
    }));
  it('#observe with query and update', () =>
    new Promise((resolve, reject) => {
      var store = new ViewDb();
      store.open().then(function () {
        var cursor = store.collection('dollhouse').find({ _id: 'echo' });
        var handle = cursor.observe({
          added: function (x) {
            expect(x.age).toBe(10);
            expect(x._id).toBe('echo');
          },
          changed: function (o, n) {
            expect(o.age).toBe(10);
            expect(n.age).toBe(100);
            handle.stop();
            resolve();
          }
        });

        store.collection('dollhouse').insert({ _id: 'echo', age: 10 }, function () {
          store.collection('dollhouse').save({ _id: 'echo', age: 100 });
        });
      });
    }));
  it('#observe with query and skip', () =>
    new Promise((resolve, reject) => {
      var store = new ViewDb();
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').insert({ _id: 'echo2' });
        store.collection('dollhouse').insert({ _id: 'echo3' });
        var cursor = store.collection('dollhouse').find({});
        var skip = 0;
        cursor.limit(1);
        var realDone = _.after(3, function () {
          cursor.toArray(function (err, res) {
            expect(res.length).toBe(0);
            handle.stop();
            resolve();
          });
        });
        var handle = cursor.observe({
          added: function () {
            cursor.skip(++skip);
            realDone();
          }
        });
      });
    }));
  it('#observe with no results', () =>
    new Promise((resolve, reject) => {
      var store = new ViewDb();
      store.open().then(function () {
        var cursor = store.collection('dollhouse').find({});
        var handle = cursor.observe({
          init: function (coll) {
            expect(coll.length).toBe(0);
            handle.stop();
            resolve();
          }
        });
      });
    }));
  it('#observe with init after one insert', () =>
    new Promise((resolve, reject) => {
      var store = new ViewDb();
      store.collection('dollhouse').insert({ _id: 'echo' }, function () {
        store.open().then(function () {
          var cursor = store.collection('dollhouse').find({});
          var handle = cursor.observe({
            init: function (coll) {
              expect(coll.length).toBe(1);
              handle.stop();
              resolve();
            }
          });
        });
      });
    }));
  it('#observe with one insert after init', () =>
    new Promise((resolve, reject) => {
      var store = new ViewDb();
      store.open().then(function () {
        var cursor = store.collection('dollhouse').find({});
        var handle = cursor.observe({
          init: function (coll) {
            expect(coll.length).toBe(0);
          },
          added: function (a) {
            expect(a._id).toBe('echo');
            handle.stop();
            resolve();
          }
        });
      });
      setTimeout(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
      }, 5);
    }));
  it('#observe with query update', () =>
    new Promise((resolve, reject) => {
      const store = new ViewDb();
      store.open().then(() => {
        const cursor = store.collection('dollhouse').find({});
        const handle = cursor.observe({
          init: (docs) => {
            expect(docs.length).toBe(0);
          },
          added: (doc) => {
            expect(doc._id).toMatch(/^echo/);
          },
          changed: (found, e) => {
            expect(found).toEqual({ _id: 'echo1', name: 'marco' });
            expect(e).toEqual({ _id: 'echo1', name: 'marco', data: 'changed' });

            handle.stop();
            resolve();
          },
          removed: (doc) => {
            expect(doc).toEqual({ _id: 'echo3', name: 'polo' });

            store.collection('dollhouse').save([{ _id: 'echo3', name: 'polo', data: 'changed' }], () => {
              store.collection('dollhouse').save([{ _id: 'echo1', name: 'marco', data: 'changed' }]);
            });
          }
        });

        store.collection('dollhouse').insert(
          [
            { _id: 'echo1', name: 'marco' },
            { _id: 'echo2', name: 'marco' },
            { _id: 'echo3', name: 'polo' }
          ],
          () => {
            cursor.updateQuery({ name: 'marco' });
          }
        );
      });
    }));
});

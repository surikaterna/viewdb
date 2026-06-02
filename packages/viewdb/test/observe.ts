import assert from 'node:assert';
import _ from 'lodash';
import ViewDb from '..';
import Collection from '../src/inmemory/collection';

describe('Observe', () => {
  it('#observe with insert', () =>
    new Promise<void>((resolve) => {
      const store = new ViewDb();
      store.open().then(function () {
        const coll = store.collection('dollhouse') as Collection;
        var cursor = coll.find({});
        var handle = cursor.observe({
          added: function (x) {
            expect(x._id).toBe('echo');
            handle.stop();
            resolve();
          }
        });
        coll.insert({ _id: 'echo' });
      });
    }));
  it('#observe with query and insert', () =>
    new Promise<void>((resolve) => {
      const store = new ViewDb();
      store.open().then(function () {
        const coll = store.collection('dollhouse') as Collection;
        coll.insert({ _id: 'echo' });
        var cursor = coll.find({ _id: 'echo2' });
        cursor.observe({
          added: function (x) {
            expect(x._id).toBe('echo2');
            resolve();
          }
        });
        coll.insert({ _id: 'echo2' });
      });
    }));
  it('#observe with query and update', () =>
    new Promise<void>((resolve) => {
      const store = new ViewDb();
      store.open().then(function () {
        const coll = store.collection('dollhouse') as Collection;
        var cursor = coll.find({ _id: 'echo' });
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

        coll.insert({ _id: 'echo', age: 10 }, function () {
          coll.save({ _id: 'echo', age: 100 });
        });
      });
    }));
  it('#observe with query and skip', () =>
    new Promise<void>((resolve) => {
      const store = new ViewDb();
      store.open().then(function () {
        const coll = store.collection('dollhouse') as Collection;
        coll.insert({ _id: 'echo' });
        coll.insert({ _id: 'echo2' });
        coll.insert({ _id: 'echo3' });
        var cursor = coll.find({});
        var skip = 0;
        cursor.limit(1);
        var realDone = _.after(3, function () {
          cursor.toArray(function (_err, res) {
            assert(res);
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
    new Promise<void>((resolve) => {
      const store = new ViewDb();
      store.open().then(function () {
        const coll = store.collection('dollhouse') as Collection;
        var cursor = coll.find({});
        var handle = cursor.observe({
          init: function (docs) {
            expect(docs.length).toBe(0);
            handle.stop();
            resolve();
          }
        });
      });
    }));
  it('#observe with init after one insert', () =>
    new Promise<void>((resolve) => {
      const store = new ViewDb();
      const coll = store.collection('dollhouse') as Collection;
      coll.insert({ _id: 'echo' }, function () {
        store.open().then(function () {
          var cursor = coll.find({});
          var handle = cursor.observe({
            init: function (docs) {
              expect(docs.length).toBe(1);
              handle.stop();
              resolve();
            }
          });
        });
      });
    }));
  it('#observe with one insert after init', () =>
    new Promise<void>((resolve) => {
      const store = new ViewDb();
      store.open().then(function () {
        const coll = store.collection('dollhouse') as Collection;
        var cursor = coll.find({});
        var handle = cursor.observe({
          init: function (docs) {
            expect(docs.length).toBe(0);
          },
          added: function (a) {
            expect(a._id).toBe('echo');
            handle.stop();
            resolve();
          }
        });
      });
      setTimeout(function () {
        const coll = store.collection('dollhouse') as Collection;
        coll.insert({ _id: 'echo' });
      }, 5);
    }));
  it('#observe with query update', () =>
    new Promise<void>((resolve) => {
      const store = new ViewDb();
      store.open().then(() => {
        const coll = store.collection('dollhouse') as Collection;
        const cursor = coll.find({});
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

            coll.save([{ _id: 'echo3', name: 'polo', data: 'changed' }], () => {
              coll.save([{ _id: 'echo1', name: 'marco', data: 'changed' }]);
            });
          }
        });

        coll.insert(
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
